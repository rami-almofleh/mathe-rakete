import { computed, effect, Injectable, inject, signal } from '@angular/core';
import { Grade, isGrade, LESSON_STEPS, LessonStep, QuizSettings, Task } from '../models';
import { ApiError } from '../auth/api-client';
import { DataApi } from '../auth/data-api';
import { Badge, BADGES, RoundResult } from './badges';
import { ProfileStore } from './profile-store';

export interface TopicStats {
  readonly answered: number;
  readonly correct: number;
  /** Gleitender Wert 0–1: wie sicher das Kind zuletzt war (neuere Antworten zählen mehr). */
  readonly recent?: number;
}

/** Eine falsch gelöste Aufgabe zum späteren Wiederholen. */
export interface StoredMistake {
  readonly id: string;
  readonly task: Task;
  readonly wrongCount: number;
  readonly lastWrong: string;
}

export interface AnsweredTask {
  readonly task: Task;
  readonly correct: boolean;
}

export interface RoundRecord {
  readonly date: string;
  readonly grade: Grade;
  readonly difficulty: QuizSettings['difficulty'];
  readonly correct: number;
  readonly total: number;
  readonly stars: number;
}

export type StarCount = 0 | 1 | 2 | 3;

/** Bestes Ergebnis je Schritt einer Lektion (Level 1–3 und Test), siehe `LESSON_STEPS`. */
export interface LessonProgress {
  readonly steps: Readonly<Partial<Record<LessonStep, StarCount>>>;
  readonly lastPlayed?: string;
}

export interface ProgressData {
  readonly version: 1;
  readonly totalStars: number;
  readonly roundsPlayed: number;
  readonly bestStreak: number;
  readonly topics: Readonly<Record<string, TopicStats>>;
  readonly recentRounds: readonly RoundRecord[];
  readonly badges: readonly string[];
  readonly lastSettings: Readonly<Partial<Record<Grade, QuizSettings>>>;
  readonly mistakes: readonly StoredMistake[];
  readonly sound: boolean;
  /** Lektionen je Thema-ID; fehlt in älteren Ständen. */
  readonly lessons: Readonly<Record<string, LessonProgress>>;
}

const MAX_RECENT_ROUNDS = 30;
/** Erste Wartezeit vor einem erneuten Speicherversuch; verdoppelt sich bis höchstens 1 Minute */
const RETRY_START_MS = 2000;
const RETRY_MAX_MS = 60_000;
const MAX_MISTAKES = 40;
/** Gewicht der neuesten Antwort im gleitenden Wert */
const RECENT_WEIGHT = 0.3;
/** Annahme für noch nie geübte Themen */
const UNSEEN_CONFIDENCE = 0.75;

/** Gleiche Aufgabe = gleiches Thema, gleicher Text, gleiches Bild */
export function mistakeId(task: Task): string {
  return [task.topicId, task.prompt.instruction ?? '', task.prompt.math.value, JSON.stringify(task.prompt.figure ?? null)].join('|');
}

export const EMPTY_PROGRESS: ProgressData = {
  version: 1,
  totalStars: 0,
  roundsPlayed: 0,
  bestStreak: 0,
  topics: {},
  recentRounds: [],
  badges: [],
  lastSettings: {},
  mistakes: [],
  sound: false,
  lessons: {},
};

/** Prüft/säubert eine Server-Antwort, genau wie früher gespeicherte Browser-Daten. */
export function parseProgress(raw: string | null): ProgressData {
  if (!raw) return EMPTY_PROGRESS;
  try {
    const data = JSON.parse(raw) as Partial<ProgressData>;
    if (data?.version !== 1) return EMPTY_PROGRESS;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
    const lastSettings = Object.fromEntries(
      Object.entries(data.lastSettings ?? {}).filter(([g, s]) => isGrade(Number(g)) && s && typeof s === 'object'),
    );
    return {
      version: 1,
      totalStars: num(data.totalStars),
      roundsPlayed: num(data.roundsPlayed),
      bestStreak: num(data.bestStreak),
      topics: data.topics && typeof data.topics === 'object' ? data.topics : {},
      recentRounds: Array.isArray(data.recentRounds) ? data.recentRounds.slice(0, MAX_RECENT_ROUNDS) : [],
      badges: Array.isArray(data.badges) ? data.badges.filter((b) => typeof b === 'string') : [],
      lastSettings,
      mistakes: Array.isArray(data.mistakes)
        ? data.mistakes.filter((m) => m && typeof m.id === 'string' && m.task?.choices?.length === 3).slice(0, MAX_MISTAKES)
        : [],
      sound: data.sound === true,
      lessons: parseLessons(data.lessons),
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

function parseLessons(raw: unknown): Record<string, LessonProgress> {
  if (!raw || typeof raw !== 'object') return {};
  const stepIds = LESSON_STEPS.map((s) => s.id as string);
  const lessons: Record<string, LessonProgress> = {};
  for (const [topicId, value] of Object.entries(raw as Record<string, Partial<LessonProgress>>)) {
    if (!value || typeof value !== 'object') continue;
    const steps = Object.fromEntries(
      Object.entries(value.steps ?? {}).filter(([step, stars]) => stepIds.includes(step) && [0, 1, 2, 3].includes(stars as number)),
    );
    lessons[topicId] = { steps, ...(typeof value.lastPlayed === 'string' ? { lastPlayed: value.lastPlayed } : {}) };
  }
  return lessons;
}

/**
 * Fortschritt des aktiven Kinder-Profils. Lokal-zuerst wie `ProfileStore`: alle Berechnungen
 * (Serien, Abzeichen, Fehlerliste, Unsicherheit je Thema) laufen unverändert rein im Speicher;
 * jede Änderung wird zusätzlich im Hintergrund an den Server geschickt. `hydrate()` holt den
 * Stand vom Server – automatisch einmal pro Profilwechsel (siehe `effect()` im Konstruktor).
 */
@Injectable({ providedIn: 'root' })
export class ProgressStore {
  private readonly api = inject(DataApi);
  private readonly profiles = inject(ProfileStore);

  private readonly _data = signal<ProgressData>(EMPTY_PROGRESS);
  private readonly _loading = signal(false);

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly sound = computed(() => this._data().sound);
  readonly earnedBadges = computed(() => new Set(this._data().badges));

  readonly accuracy = computed(() => {
    const stats = Object.values(this._data().topics);
    const answered = stats.reduce((s, t) => s + t.answered, 0);
    return answered ? stats.reduce((s, t) => s + t.correct, 0) / answered : null;
  });

  readonly mistakes = computed(() => this._data().mistakes);

  /** Zuletzt geübte Lektion (Thema-ID) – für „Zuletzt geübt“ in der Lektionsliste. */
  readonly lastLessonId = computed(() => {
    let best: { id: string; at: string } | null = null;
    for (const [id, lesson] of Object.entries(this._data().lessons)) {
      if (lesson.lastPlayed && (!best || lesson.lastPlayed > best.at)) best = { id, at: lesson.lastPlayed };
    }
    return best?.id ?? null;
  });

  lesson(topicId: string): LessonProgress {
    return this._data().lessons[topicId] ?? { steps: {} };
  }

  /** Noch nicht beim Server angekommene Stände je Profil (immer nur der neueste) */
  private readonly pending = new Map<string, ProgressData>();
  private flushing = false;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private retryDelay = RETRY_START_MS;

  constructor() {
    // Verbindung wieder da → liegengebliebene Stände sofort nachschicken
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.flush());
    }

    // Ersetzt das frühere linkedSignal auf localStorage: bei jedem Profilwechsel (auch dem
    // ersten nach dem Login) neu vom Server holen, ohne dass ein Aufrufer das anstoßen muss.
    effect(() => {
      const id = this.profiles.activeId();
      void this.hydrate(id);
    });
  }

  /** Wie unsicher das Kind in einem Thema ist (0 = sicher, 1 = alles falsch). */
  weakness(topicId: string): number {
    return 1 - (this._data().topics[topicId]?.recent ?? UNSEEN_CONFIDENCE);
  }

  async hydrate(profileId: string | null = this.profiles.activeId()): Promise<void> {
    if (!profileId) {
      this._data.set(EMPTY_PROGRESS);
      return;
    }
    // Noch nicht gespeicherter lokaler Stand ist neuer als der Server – nicht überschreiben
    const unsynced = this.pending.get(profileId);
    if (unsynced) {
      this._data.set(unsynced);
      return;
    }
    this._loading.set(true);
    try {
      const raw = await this.api.get<unknown>(`/progress/${profileId}`);
      if (this.pending.has(profileId)) return; // während des Ladens lokal weitergespielt
      this._data.set(parseProgress(JSON.stringify(raw)));
    } catch {
      // Server nicht erreichbar – zeigt weiter, was zuletzt bekannt war
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Wertet eine beendete Runde aus und liefert die neu verdienten Abzeichen.
   * `answers` in der Reihenfolge der Runde (für die längste Serie).
   * Falsche Aufgaben kommen auf die Wiederholungsliste, richtig gelöste Wiederholungen verschwinden.
   */
  recordRound(settings: QuizSettings, answers: readonly AnsweredTask[], stars: number): Badge[] {
    if (!answers.length) return [];
    const current = this._data();

    const topics: Record<string, TopicStats> = { ...current.topics };
    for (const { task, correct } of answers) {
      const t = topics[task.topicId] ?? { answered: 0, correct: 0 };
      const recent = (t.recent ?? UNSEEN_CONFIDENCE) * (1 - RECENT_WEIGHT) + (correct ? 1 : 0) * RECENT_WEIGHT;
      topics[task.topicId] = { answered: t.answered + 1, correct: t.correct + (correct ? 1 : 0), recent };
    }

    let streak = 0;
    let longestStreak = 0;
    for (const a of answers) {
      streak = a.correct ? streak + 1 : 0;
      longestStreak = Math.max(longestStreak, streak);
    }

    const correct = answers.filter((a) => a.correct).length;
    const round: RoundResult = {
      settings,
      total: answers.length,
      correct,
      stars,
      longestStreak,
      topicIds: [...new Set(answers.map((a) => a.task.topicId))],
    };
    const next: ProgressData = {
      ...current,
      totalStars: current.totalStars + stars,
      roundsPlayed: current.roundsPlayed + 1,
      bestStreak: Math.max(current.bestStreak, longestStreak),
      topics,
      recentRounds: [
        { date: new Date().toISOString(), grade: settings.grade, difficulty: settings.difficulty, correct, total: answers.length, stars },
        ...current.recentRounds,
      ].slice(0, MAX_RECENT_ROUNDS),
      mistakes: updateMistakes(current.mistakes, answers),
    };

    const context = {
      round,
      totalStars: next.totalStars,
      roundsPlayed: next.roundsPlayed,
      bestStreak: next.bestStreak,
      correctByTopic: Object.fromEntries(Object.entries(topics).map(([id, t]) => [id, t.correct])),
    };
    const newBadges = BADGES.filter((b) => !current.badges.includes(b.id) && b.earned(context));
    this.save({
      ...next,
      badges: [...current.badges, ...newBadges.map((b) => b.id)],
      lessons: settings.lesson ? updateLesson(current.lessons, settings.lesson, stars as StarCount) : current.lessons,
    });
    return newBadges;
  }

  settingsFor(grade: Grade): QuizSettings | undefined {
    return this._data().lastSettings[grade];
  }

  rememberSettings(settings: QuizSettings): void {
    const current = this._data();
    this.save({ ...current, lastSettings: { ...current.lastSettings, [settings.grade]: settings } });
  }

  setSound(on: boolean): void {
    this.save({ ...this._data(), sound: on });
  }

  /** Alles zurücksetzen (Einstellungen für Töne bleiben). */
  reset(): void {
    this.save({ ...EMPTY_PROGRESS, sound: this._data().sound });
  }

  /** Sterne eines (auch nicht aktiven) Profils – für die Profilauswahl. */
  starsOf(profileId: string): number {
    return this.profiles.totalStarsOf(profileId);
  }

  private save(data: ProgressData): void {
    this._data.set(data); // sofort sichtbar, unverändert synchron wie zuvor
    const id = this.profiles.activeId();
    if (!id) return; // ohne Profil nichts zu speichern
    this.profiles.setTotalStars(id, data.totalStars); // Profilkarten sofort mitziehen lassen
    this.pending.set(id, data);
    void this.flush();
  }

  /**
   * Schickt ausstehende Stände nacheinander (nie parallel – sonst könnte ein älterer Stand einen neueren
   * überholen). Bei Netz-/Serverfehlern wird mit wachsendem Abstand erneut versucht, damit keine Sterne
   * verloren gehen.
   */
  private async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    clearTimeout(this.retryTimer);
    try {
      while (this.pending.size) {
        const [id, data] = this.pending.entries().next().value!;
        try {
          await this.api.put(`/progress/${id}`, data);
          if (this.pending.get(id) === data) this.pending.delete(id); // sonst kam inzwischen ein neuerer Stand
          this.retryDelay = RETRY_START_MS;
        } catch (error) {
          // 4xx (außer 408/429): erneutes Senden hilft nicht (z. B. abgemeldet, Profil gelöscht)
          if (error instanceof ApiError && error.status < 500 && error.status !== 408 && error.status !== 429) {
            this.pending.delete(id);
            continue;
          }
          this.retryTimer = setTimeout(() => void this.flush(), this.retryDelay);
          this.retryDelay = Math.min(this.retryDelay * 2, RETRY_MAX_MS);
          return;
        }
      }
    } finally {
      this.flushing = false;
    }
  }
}

/** Bestes Ergebnis zählt – ein schwächerer Versuch nimmt keine Sterne weg. */
function updateLesson(
  lessons: Readonly<Record<string, LessonProgress>>,
  { topicId, step }: { topicId: string; step: LessonStep },
  stars: StarCount,
): Record<string, LessonProgress> {
  const previous = lessons[topicId]?.steps ?? {};
  const best = Math.max(previous[step] ?? 0, stars) as StarCount;
  return { ...lessons, [topicId]: { steps: { ...previous, [step]: best }, lastPlayed: new Date().toISOString() } };
}

/** Falsche Aufgaben vorne einreihen (mehrfach falsch → Zähler hoch), richtig gelöste streichen. */
function updateMistakes(current: readonly StoredMistake[], answers: readonly AnsweredTask[]): StoredMistake[] {
  let list = [...current]; // neueste zuerst
  const now = new Date().toISOString();
  for (const { task, correct } of answers) {
    const id = mistakeId(task);
    const previous = list.find((m) => m.id === id);
    list = list.filter((m) => m.id !== id);
    if (!correct) {
      list.unshift({ id, task, wrongCount: (previous?.wrongCount ?? 0) + 1, lastWrong: now });
    }
  }
  return list.slice(0, MAX_MISTAKES);
}
