import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { ClientLogger } from '../logging/client-logger';
import { Badge } from '../progress/badges';
import { ProgressStore } from '../progress/progress-store';
import { TaskFactory } from '../generators/task-factory';
import { Rng } from '../math/rng';
import { Grade, QuizSettings, Task } from '../models';
import { GENERATOR_REGISTRY, MAX_TASKS_PER_ROUND, QUIZ_CLOCK, starsFor } from './quiz-config';
import { PoolEntry, poolFor } from './topic-pool';

export type QuizPhase = 'question' | 'feedback' | 'finished';

export interface AnswerRecord {
  readonly task: Task;
  /** `null` = Zeit abgelaufen. */
  readonly chosenIndex: number | null;
  readonly correct: boolean;
  readonly durationMs: number;
}

export interface QuizSummary {
  readonly total: number;
  readonly correct: number;
  readonly accuracy: number;
  readonly stars: 0 | 1 | 2 | 3;
  readonly durationMs: number;
  readonly mistakes: readonly AnswerRecord[];
}

const TICK_MS = 100;
/** Aufgaben je Wiederholungsrunde */
const REVIEW_SIZE = 10;
/** Wie stark unsichere Themen bevorzugt werden (1 + Faktor · Unsicherheit) */
const WEAKNESS_BOOST = 3;
/** Versuche, eine Aufgabe zu vermeiden, die in dieser Runde schon dran war. */
const REPEAT_AVOIDANCE_TRIES = 8;

/** Ablauf einer Quiz-Runde: Aufgaben erzeugen, Antworten werten, Timer führen. */
@Injectable({ providedIn: 'root' })
export class QuizSession implements OnDestroy {
  private readonly registry = inject(GENERATOR_REGISTRY);
  private readonly now = inject(QUIZ_CLOCK);
  private readonly progress = inject(ProgressStore);
  private readonly logger = inject(ClientLogger);

  private rng = new Rng();
  private factory = new TaskFactory(this.registry, this.rng);
  private pool: PoolEntry[] = [];
  private seenPrompts = new Set<string>();
  private reviewQueue: Task[] = [];
  private interval?: ReturnType<typeof setInterval>;
  private lastTick = 0;
  private taskStartedAt = 0;

  private readonly _settings = signal<QuizSettings | null>(null);
  private readonly _task = signal<Task | null>(null);
  private readonly _phase = signal<QuizPhase>('question');
  private readonly _records = signal<readonly AnswerRecord[]>([]);
  private readonly _remainingMs = signal<number | null>(null);
  private readonly _newBadges = signal<readonly Badge[]>([]);

  readonly settings = this._settings.asReadonly();
  readonly task = this._task.asReadonly();
  readonly phase = this._phase.asReadonly();
  readonly records = this._records.asReadonly();
  /** Restzeit der Aufgabe bzw. der Runde; `null` ohne Timer. */
  readonly remainingMs = this._remainingMs.asReadonly();

  /** Abzeichen, die in der gerade beendeten Runde neu dazugekommen sind. */
  readonly newBadges = this._newBadges.asReadonly();

  readonly lastRecord = computed(() => this._records().at(-1) ?? null);

  /** Richtige Antworten hintereinander bis jetzt. */
  readonly currentStreak = computed(() => {
    const records = this._records();
    let streak = 0;
    for (let i = records.length - 1; i >= 0 && records[i].correct; i--) streak++;
    return streak;
  });
  readonly correctCount = computed(() => this._records().filter((r) => r.correct).length);

  /** Zeitanteil 0–1 für den Timer-Balken. */
  readonly timeFraction = computed(() => {
    const remaining = this._remainingMs();
    const timer = this._settings()?.timer;
    if (remaining === null || !timer || timer.mode === 'off') return null;
    return Math.max(0, remaining / (timer.seconds * 1000));
  });

  readonly summary = computed<QuizSummary>(() => {
    const records = this._records();
    const correct = records.filter((r) => r.correct).length;
    return {
      total: records.length,
      correct,
      accuracy: records.length ? correct / records.length : 0,
      stars: starsFor(correct, records.length),
      durationMs: records.reduce((sum, r) => sum + r.durationMs, 0),
      mistakes: records.filter((r) => !r.correct),
    };
  });

  start(settings: QuizSettings): void {
    if (settings.mode === 'review') {
      this.startReview();
      return;
    }
    this.stopTimer();
    const pool = poolFor(settings, (id) => this.registry.has(id));
    if (!pool.length) {
      throw new Error('Für diese Auswahl gibt es noch keine Aufgaben');
    }
    this.rng = new Rng();
    this.factory = new TaskFactory(this.registry, this.rng);
    this.pool = pool;
    this.seenPrompts.clear();
    this._settings.set(settings);
    this._records.set([]);
    this._newBadges.set([]);
    this._remainingMs.set(settings.timer.mode === 'perRound' ? settings.timer.seconds * 1000 : null);
    this.logger.breadcrumb('quiz:start', {
      grade: settings.grade,
      mode: settings.mode,
      difficulty: settings.difficulty,
      timer: settings.timer,
      taskCount: settings.taskCount,
      topics: settings.mode === 'topics' ? settings.topicIds : settings.operations,
    });
    this.nextTask();
    if (settings.timer.mode !== 'off') {
      this.lastTick = this.now();
      this.interval = setInterval(() => this.tick(), TICK_MS);
    }
  }

  /** Gemerkte Fehler wiederholen (neueste zuerst, höchstens 10, Antworten neu gemischt). */
  startReview(): void {
    const mistakes = this.progress.mistakes().slice(0, REVIEW_SIZE);
    if (!mistakes.length) {
      throw new Error('Keine Aufgaben zum Wiederholen');
    }
    this.stopTimer();
    this.rng = new Rng();
    this.reviewQueue = this.rng.shuffle(mistakes).map((m, i) => this.reshuffle(m.task, `review-${i}`));
    this.pool = [];
    this.seenPrompts.clear();
    this._settings.set({
      grade: Math.max(...mistakes.map((m) => m.task.grade)) as Grade,
      mode: 'review',
      operations: [],
      topicIds: [],
      difficulty: 'easy',
      timer: { mode: 'off' },
      taskCount: this.reviewQueue.length,
    });
    this._records.set([]);
    this._newBadges.set([]);
    this._remainingMs.set(null);
    this.logger.breadcrumb('quiz:start-review', { tasks: this.reviewQueue.length });
    this.nextTask();
  }

  restart(): void {
    const settings = this._settings();
    if (settings) this.start(settings);
  }

  answer(index: number): void {
    if (this._phase() !== 'question' || index < 0 || index > 2) {
      this.logger.breadcrumb('quiz:answer-ignored', { index, phase: this._phase() });
      return;
    }
    this.record(index);
  }

  next(): void {
    if (this._phase() !== 'feedback') return;
    this.logger.breadcrumb('quiz:next', { done: this._records().length });
    if (this.isRoundOver()) {
      this.finish();
    } else {
      this.nextTask();
    }
  }

  /** Timer neu anstoßen, falls er (z. B. nach einem Fehler) nicht mehr läuft – für den Quiz-Wächter. */
  resumeTimer(): void {
    const settings = this._settings();
    if (!settings || settings.timer.mode === 'off' || this._phase() === 'finished') return;
    this.stopTimer();
    this.lastTick = this.now();
    this.interval = setInterval(() => this.tick(), TICK_MS);
    this.logger.breadcrumb('quiz:timer-resumed');
  }

  /** Runde vorzeitig beenden (Kind verlässt das Quiz). */
  abandon(): void {
    if (this._settings()) this.logger.breadcrumb('quiz:abandon', { phase: this._phase(), done: this._records().length });
    this.stopTimer();
    this._settings.set(null);
    this._task.set(null);
    this._records.set([]);
    this._phase.set('question');
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  private nextTask(): void {
    const settings = this._settings()!;
    let task: Task;
    try {
      task = this.createTask(settings);
    } catch (error) {
      const err = error as Error;
      this.logger.report('error', `Keine Aufgabe erzeugbar: ${err.message}`, { stack: err.stack, context: { settings } });
      // Lieber sauber mit Ergebnis beenden als in der Rückmeldung festzuhängen
      if (this._records().length) {
        this.finish();
        return;
      }
      throw error;
    }

    this._task.set(task);
    this._phase.set('question');
    this.taskStartedAt = this.now();
    if (settings.timer.mode === 'perTask') {
      this._remainingMs.set(settings.timer.seconds * 1000);
    }
    this.logger.breadcrumb('quiz:task', { n: this._records().length + 1, topic: task.topicId, prompt: task.prompt.math.value.slice(0, 60) });
  }

  /** Nächste Aufgabe; scheitert ein Thema (Generator-Fehler), wird ein anderes gezogen. */
  private createTask(settings: QuizSettings): Task {
    if (settings.mode === 'review') {
      const task = this.reviewQueue.shift();
      if (!task) throw new Error('Wiederholungsliste ist leer');
      return task;
    }
    const operations = settings.mode === 'arithmetic' ? settings.operations : undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        let task: Task;
        let tries = 0;
        do {
          // Themen, bei denen das Kind unsicher ist, kommen öfter dran
          const entry = this.rng.weighted(this.pool, (e) => 1 + WEAKNESS_BOOST * this.progress.weakness(e.topic.id));
          task = this.factory.create(entry.topic.id, entry.difficulty, operations);
        } while (this.seenPrompts.has(task.prompt.math.value) && ++tries < REPEAT_AVOIDANCE_TRIES);
        this.seenPrompts.add(task.prompt.math.value);
        return task;
      } catch (error) {
        lastError = error;
        this.logger.breadcrumb('quiz:task-failed', { attempt, message: String((error as Error)?.message).slice(0, 160) });
      }
    }
    throw lastError;
  }

  private record(chosenIndex: number | null): void {
    const task = this._task()!;
    this._records.update((records) => [
      ...records,
      {
        task,
        chosenIndex,
        correct: chosenIndex === task.correctIndex,
        durationMs: this.now() - this.taskStartedAt,
      },
    ]);
    this._phase.set('feedback');
    this.logger.breadcrumb(chosenIndex === null ? 'quiz:timeout' : 'quiz:answer', { chosen: chosenIndex, correct: chosenIndex === task.correctIndex });
  }

  private tick(): void {
    const t = this.now();
    const elapsed = t - this.lastTick;
    this.lastTick = t;
    // Während der Rückmeldung läuft die Zeit nicht – Lesen des Lösungswegs kostet nichts.
    if (this._phase() !== 'question') return;

    const remaining = (this._remainingMs() ?? 0) - elapsed;
    this._remainingMs.set(Math.max(0, remaining));
    if (remaining > 0) return;

    if (this._settings()?.timer.mode === 'perTask') {
      this.record(null);
    } else {
      // Runde vorbei: die angefangene Aufgabe zählt nicht
      this.finish();
    }
  }

  private isRoundOver(): boolean {
    const settings = this._settings()!;
    const count = this._records().length;
    if (settings.timer.mode === 'perRound') {
      return (this._remainingMs() ?? 0) <= 0 || count >= MAX_TASKS_PER_ROUND;
    }
    return count >= settings.taskCount;
  }

  private finish(): void {
    this.stopTimer();
    this.logger.breadcrumb('quiz:finish', { done: this._records().length });
    const settings = this._settings();
    if (settings) {
      const answers = this._records().map((r) => ({ task: r.task, correct: r.correct }));
      this._newBadges.set(this.progress.recordRound(settings, answers, this.summary().stars));
    }
    this._phase.set('finished');
  }

  /** Gleiche Aufgabe, neue Reihenfolge der Antworten */
  private reshuffle(task: Task, id: string): Task {
    const order = this.rng.shuffle([0, 1, 2]);
    return {
      ...task,
      id,
      choices: order.map((i) => task.choices[i]) as unknown as Task['choices'],
      correctIndex: order.indexOf(task.correctIndex) as Task['correctIndex'],
    };
  }

  private stopTimer(): void {
    if (this.interval !== undefined) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }
}
