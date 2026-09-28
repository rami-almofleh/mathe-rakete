import { computed, Injectable, inject, linkedSignal } from '@angular/core';
import { Grade, isGrade, QuizSettings, Task } from '../models';
import { Badge, BADGES, RoundResult } from './badges';
import { ProfileStore, progressKey } from './profile-store';
import { PROGRESS_STORAGE } from './progress-storage';

export { PROGRESS_STORAGE } from './progress-storage';

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
}

const MAX_RECENT_ROUNDS = 30;
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
};

/** Liest gespeicherte Daten und ergänzt fehlende Felder; unbrauchbare Daten → leerer Fortschritt. */
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
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

/** Fortschritt des aktiven Kinder-Profils – lokal im Browser, ohne Konto. */
@Injectable({ providedIn: 'root' })
export class ProgressStore {
  private readonly storage = inject(PROGRESS_STORAGE);
  private readonly profiles = inject(ProfileStore);
  /** Wird neu geladen, sobald ein anderes Profil ausgewählt wird. */
  private readonly _data = linkedSignal<string | null, ProgressData>({
    source: this.profiles.activeId,
    computation: (id) => this.load(id),
  });

  readonly data = this._data.asReadonly();
  readonly sound = computed(() => this._data().sound);
  readonly earnedBadges = computed(() => new Set(this._data().badges));

  readonly accuracy = computed(() => {
    const stats = Object.values(this._data().topics);
    const answered = stats.reduce((s, t) => s + t.answered, 0);
    return answered ? stats.reduce((s, t) => s + t.correct, 0) / answered : null;
  });

  readonly mistakes = computed(() => this._data().mistakes);

  /** Wie unsicher das Kind in einem Thema ist (0 = sicher, 1 = alles falsch). */
  weakness(topicId: string): number {
    return 1 - (this._data().topics[topicId]?.recent ?? UNSEEN_CONFIDENCE);
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
    this.save({ ...next, badges: [...current.badges, ...newBadges.map((b) => b.id)] });
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
    return this.load(profileId).totalStars;
  }

  private load(profileId: string | null): ProgressData {
    if (!profileId) return EMPTY_PROGRESS;
    try {
      return parseProgress(this.storage?.getItem(progressKey(profileId)) ?? null);
    } catch {
      return EMPTY_PROGRESS;
    }
  }

  private save(data: ProgressData): void {
    this._data.set(data);
    const id = this.profiles.activeId();
    if (!id) return; // ohne Profil nur für diese Sitzung
    try {
      this.storage?.setItem(progressKey(id), JSON.stringify(data));
    } catch {
      // Speicher voll oder blockiert – der Fortschritt gilt dann nur für diese Sitzung
    }
  }
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
