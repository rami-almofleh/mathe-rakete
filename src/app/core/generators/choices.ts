import { Choice } from '../models';
import { Rng } from '../math/rng';
import { inDomain, NumberDomain } from './domain';
import { Answer, GeneratedTask } from './generator';

export const CHOICE_COUNT = 3;
const FALLBACK_ATTEMPTS = 30;

export interface ChoiceSet {
  readonly choices: readonly [Choice, Choice, Choice];
  readonly correctIndex: 0 | 1 | 2;
}

/**
 * Wählt 2 Ablenker aus den Fehlermustern (bei Bedarf aufgefüllt), mischt sie mit der
 * richtigen Antwort und liefert `null`, wenn keine 3 verschiedenen Antworten zustande kommen.
 */
export function buildChoices(task: GeneratedTask, domain: NumberDomain, rng: Rng): ChoiceSet | null {
  const needed = CHOICE_COUNT - 1;
  const usedKeys = new Set([task.answer.key]);
  const usedDisplays = new Set([task.answer.display.value]);

  const accept = (candidate: Answer): boolean => {
    if (usedKeys.has(candidate.key) || usedDisplays.has(candidate.display.value)) {
      return false;
    }
    if (candidate.value && !inDomain(candidate.value, domain)) {
      return false;
    }
    usedKeys.add(candidate.key);
    usedDisplays.add(candidate.display.value);
    return true;
  };

  const pool = task.distractors.filter(accept);
  const distractors = rng.shuffle(pool).slice(0, needed);

  for (let i = 0; distractors.length < needed && task.fallback && i < FALLBACK_ATTEMPTS; i++) {
    let candidate: Answer;
    try {
      candidate = task.fallback(rng);
    } catch {
      continue;
    }
    if (accept(candidate)) {
      distractors.push(candidate);
    }
  }

  if (distractors.length < needed) {
    return null;
  }

  const answers = rng.shuffle([task.answer, ...distractors]);
  const correctIndex = answers.indexOf(task.answer) as 0 | 1 | 2;
  const choices = answers.map(({ display, key }) => ({ display, key })) as [Choice, Choice, Choice];
  return { choices, correctIndex };
}
