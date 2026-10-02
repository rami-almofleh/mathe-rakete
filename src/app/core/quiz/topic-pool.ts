import { ARITHMETIC_PLAN } from '../curriculum/arithmetic-plan';
import { findTopic, gradeOf, Topic, TOPICS, topicsUpToGrade } from '../curriculum/curriculum';
import { Difficulty, Grade, LESSON_STEPS, LessonStep, Operation, OPERATIONS, QuizSettings } from '../models';

export type HasGenerator = (topicId: string) => boolean;

/** Ein Eintrag im Aufgabenpool: Thema + Schwierigkeit, mit der es erzeugt wird. */
export interface PoolEntry {
  readonly topic: Topic;
  readonly difficulty: Difficulty;
}

function unique(entries: PoolEntry[]): PoolEntry[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    const key = `${e.topic.id}/${e.difficulty}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Modus „Rechnen“.
 * - Grundschule: fester Plan je Klasse, Rechenart und Schwierigkeit (siehe ARITHMETIC_PLAN).
 * - Ab Kl. 5: für jede Rechenart die Themen der höchsten Klasse ≤ `grade`, mit der gewählten
 *   Schwierigkeit. So bekommt ein Kind in Kl. 6 bei „+“ Bruch- und Dezimalrechnung, nicht „4 + 3“.
 */
export function arithmeticPool(grade: Grade, operations: readonly Operation[], difficulty: Difficulty, has: HasGenerator, state = 'de'): PoolEntry[] {
  const pool: PoolEntry[] = [];
  for (const op of operations) {
    const planned = ARITHMETIC_PLAN[grade]?.[op]?.[difficulty];
    if (planned) {
      for (const { topicId, difficulty: d } of planned) {
        const topic = findTopic(topicId);
        if (topic && has(topicId)) pool.push({ topic, difficulty: d });
      }
      continue;
    }
    for (let g = grade; g >= 1; g--) {
      const matches = TOPICS.filter((t) => gradeOf(t, state) === g && t.operations?.includes(op) && has(t.id));
      if (matches.length) {
        pool.push(...matches.map((topic) => ({ topic, difficulty })));
        break;
      }
    }
  }
  return unique(pool);
}

/** Rechenarten, für die es in dieser Klasse Aufgaben gibt. */
export function availableOperations(grade: Grade, has: HasGenerator, state = 'de'): Operation[] {
  return OPERATIONS.map((o) => o.id).filter((op) => arithmeticPool(grade, [op], 'easy', has, state).length > 0);
}

/** Vorauswahl im Modus „Themen“: alle fertigen Themen der eigenen Klasse, sonst der nächst­niedrigeren. */
export function defaultTopicSelection(grade: Grade, has: HasGenerator, state = 'de'): string[] {
  for (let g = grade; g >= 1; g--) {
    const ids = TOPICS.filter((t) => gradeOf(t, state) === g && has(t.id)).map((t) => t.id);
    if (ids.length) return ids;
  }
  return [];
}

export function poolFor(settings: QuizSettings, has: HasGenerator): PoolEntry[] {
  if (settings.lesson) {
    const topic = findTopic(settings.lesson.topicId);
    if (!topic || !has(topic.id)) return [];
    // Test: alle drei Level gemischt; sonst genau das Level
    const difficulties: readonly Difficulty[] = settings.lesson.step === 'test' ? ['easy', 'medium', 'hard'] : [settings.lesson.step];
    return difficulties.map((difficulty) => ({ topic, difficulty }));
  }
  if (settings.mode === 'arithmetic') {
    return arithmeticPool(settings.grade, settings.operations, settings.difficulty, has, settings.state);
  }
  const allowed = new Set(settings.topicIds);
  return topicsUpToGrade(settings.grade, settings.state)
    .filter((t) => allowed.has(t.id) && has(t.id))
    .map((topic) => ({ topic, difficulty: settings.difficulty }));
}

/** Einstellungen für einen Schritt einer Lektion: ohne Zeit, feste Aufgabenzahl. */
export function lessonSettings(grade: Grade, topicId: string, step: LessonStep, state?: string): QuizSettings {
  const info = LESSON_STEPS.find((s) => s.id === step)!;
  return {
    grade,
    mode: 'topics',
    operations: [],
    topicIds: [topicId],
    difficulty: step === 'test' ? 'medium' : step,
    timer: { mode: 'off' },
    taskCount: info.tasks,
    state,
    lesson: { topicId, step },
  };
}
