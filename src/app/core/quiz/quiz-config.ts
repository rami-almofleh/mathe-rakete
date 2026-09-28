import { InjectionToken } from '@angular/core';
import { createDefaultRegistry } from '../generators/all-generators';
import { GeneratorRegistry } from '../generators/registry';
import { Difficulty, Grade } from '../models';

/** Alle verfügbaren Generatoren; in Tests austauschbar. */
export const GENERATOR_REGISTRY = new InjectionToken<GeneratorRegistry>('GENERATOR_REGISTRY', {
  providedIn: 'root',
  factory: createDefaultRegistry,
});

/** Uhr für Timer; in Tests austauschbar. */
export const QUIZ_CLOCK = new InjectionToken<() => number>('QUIZ_CLOCK', {
  providedIn: 'root',
  factory: () => () => Date.now(),
});

export const TASK_SECONDS_OPTIONS = [10, 15, 20, 30, 45, 60, 90] as const;
export const ROUND_SECONDS_OPTIONS = [60, 120, 180, 300] as const;
export const TASK_COUNT_OPTIONS = [10, 20, 30] as const;

/** Sicherheitsgrenze im Runden-Modus. */
export const MAX_TASKS_PER_ROUND = 200;

/** Richtwerte pro Aufgabe (Sekunden), siehe docs/RECHERCHE.md. */
const SUGGESTED_SECONDS: readonly { maxGrade: number; seconds: Record<Difficulty, number> }[] = [
  { maxGrade: 2, seconds: { easy: 10, medium: 15, hard: 20 } },
  { maxGrade: 4, seconds: { easy: 15, medium: 20, hard: 30 } },
  { maxGrade: 7, seconds: { easy: 20, medium: 30, hard: 45 } },
  { maxGrade: 10, seconds: { easy: 30, medium: 45, hard: 60 } },
  { maxGrade: 12, seconds: { easy: 45, medium: 60, hard: 90 } },
];

export function suggestedTaskSeconds(grade: Grade, difficulty: Difficulty): number {
  return SUGGESTED_SECONDS.find((s) => grade <= s.maxGrade)!.seconds[difficulty];
}

/** 3 Sterne ab 90 %, 2 ab 70 %, 1 ab 50 %. */
export function starsFor(correct: number, total: number): 0 | 1 | 2 | 3 {
  if (total === 0) return 0;
  const accuracy = correct / total;
  return accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : accuracy >= 0.5 ? 1 : 0;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}:${String(seconds).padStart(2, '0')} min` : `${seconds} s`;
}
