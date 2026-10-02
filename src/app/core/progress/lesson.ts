import { LESSON_STEPS, LessonStep } from '../models';
import type { LessonProgress, StarCount } from './progress-store';

/** Farbe im Fortschrittsbalken: grau = offen, gelb = angefangen, grün = geschafft. */
export type StepState = 'open' | 'started' | 'done';

/** Ein Level gilt mit 3 Sternen als geschafft, der Test schon mit 2 (≥ 70 % ohne Hilfen). */
export function stepState(step: LessonStep, stars: StarCount | undefined): StepState {
  if (stars === undefined) return 'open';
  return stars >= (step === 'test' ? 2 : 3) ? 'done' : 'started';
}

/** Erster noch nicht geschaffter Schritt – dorthin führt „Weiter“; `null` = alles geschafft. */
export function nextOpenStep(lesson: LessonProgress): LessonStep | null {
  return LESSON_STEPS.find((s) => stepState(s.id, lesson.steps[s.id]) !== 'done')?.id ?? null;
}

/** Schritt nach `step` (Level 1 → Level 2 → Level 3 → Test); `null` nach dem Test. */
export function followingStep(step: LessonStep): LessonStep | null {
  const index = LESSON_STEPS.findIndex((s) => s.id === step);
  return LESSON_STEPS[index + 1]?.id ?? null;
}

export function stepLabel(step: LessonStep): string {
  return LESSON_STEPS.find((s) => s.id === step)!.label;
}
