import { findTopic } from '../curriculum/curriculum';
import { Difficulty, Grade, Operation, Task } from '../models';
import { Rng } from '../math/rng';
import { buildChoices } from './choices';
import { defaultDomain, inDomain } from './domain';
import { GeneratedTask, TaskGenerator } from './generator';
import { GeneratorRegistry } from './registry';
import { validateTask } from './validate';

const MAX_ATTEMPTS = 25;

export type TaskResult = { readonly ok: true; readonly task: Task } | { readonly ok: false; readonly problem: string };

export interface TaskRequest {
  readonly id: string;
  readonly grade: Grade;
  readonly difficulty: Difficulty;
  readonly rng: Rng;
  readonly operations?: readonly Operation[];
}

/** Ein einzelner Versuch: Generator ausführen, Antworten bauen, Ergebnis prüfen. */
export function tryCreateTask(generator: TaskGenerator, request: TaskRequest): TaskResult {
  const { id, grade, difficulty, rng, operations } = request;

  let generated: GeneratedTask;
  try {
    generated = generator.generate({ difficulty, rng, operations });
  } catch (error) {
    return { ok: false, problem: `Generator-Fehler: ${(error as Error).message}` };
  }

  const domain = { ...defaultDomain(grade), ...generated.domain };
  if (generated.answer.value && !inDomain(generated.answer.value, domain)) {
    return { ok: false, problem: `Lösung ${generated.answer.value.key()} liegt außerhalb des Zahlenbereichs` };
  }

  const choiceSet = buildChoices(generated, domain, rng);
  if (!choiceSet) {
    return { ok: false, problem: 'Nicht genug verschiedene Ablenker' };
  }

  const task: Task = {
    id,
    topicId: generator.topicId,
    grade,
    difficulty,
    prompt: generated.prompt,
    ...choiceSet,
    explanation: generated.explanation,
  };
  const problems = validateTask(task, generated.answer.key);
  return problems.length ? { ok: false, problem: problems.join('; ') } : { ok: true, task };
}

/** Erzeugt gültige Aufgaben; ungültige Versuche werden verworfen und neu erzeugt. */
export class TaskFactory {
  private sequence = 0;

  constructor(
    private readonly registry: GeneratorRegistry,
    private readonly rng: Rng = new Rng(),
  ) {}

  create(topicId: string, difficulty: Difficulty, operations?: readonly Operation[]): Task {
    const generator = this.registry.get(topicId);
    const topic = findTopic(topicId);
    if (!generator || !topic) {
      throw new Error(`Kein Generator für ${topicId}`);
    }

    const id = `${topicId}-${++this.sequence}`;
    let lastProblem = '';
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const result = tryCreateTask(generator, { id, grade: topic.grade, difficulty, rng: this.rng, operations });
      if (result.ok) {
        return result.task;
      }
      lastProblem = result.problem;
    }
    throw new Error(`${topicId} (${difficulty}): nach ${MAX_ATTEMPTS} Versuchen keine gültige Aufgabe – ${lastProblem}`);
  }
}
