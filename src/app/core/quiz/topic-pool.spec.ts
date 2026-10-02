import { ARITHMETIC_PLAN } from '../curriculum/arithmetic-plan';
import { findTopic } from '../curriculum/curriculum';
import { createDefaultRegistry } from '../generators/all-generators';
import { TaskFactory } from '../generators/task-factory';
import { Rng } from '../math/rng';
import { Difficulty, Grade, Operation, Task } from '../models';
import { formatDuration, starsFor, suggestedTaskSeconds } from './quiz-config';
import { arithmeticPool, availableOperations, defaultTopicSelection, lessonSettings, poolFor } from './topic-pool';

const registry = createDefaultRegistry();
const has = (id: string) => registry.has(id);
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

/** Aufgaben so erzeugen, wie das Quiz es im Modus „Rechnen“ tut. */
function arithmeticTasks(grade: Grade, op: Operation, difficulty: Difficulty, count = 300): Task[] {
  const pool = arithmeticPool(grade, [op], difficulty, has);
  const rng = new Rng(grade * 1000 + difficulty.length);
  const factory = new TaskFactory(registry, rng);
  return Array.from({ length: count }, () => {
    const entry = rng.pick(pool);
    return factory.create(entry.topic.id, entry.difficulty, [op]);
  });
}

const numbersIn = (text: string) => [...text.replace(/ /g, '').matchAll(/\d+/g)].map((m) => Number(m[0]));

describe('arithmetic plan (primary school)', () => {
  it('only refers to existing topics that practice the operation', () => {
    for (const [grade, ops] of Object.entries(ARITHMETIC_PLAN)) {
      for (const [op, levels] of Object.entries(ops!)) {
        for (const d of DIFFICULTIES) {
          expect(levels[d].length, `Kl. ${grade} ${op} ${d}`).toBeGreaterThan(0);
          for (const { topicId } of levels[d]) {
            const topic = findTopic(topicId);
            expect(topic, topicId).toBeTruthy();
            expect(topic!.grade).toBeLessThanOrEqual(Number(grade));
            expect(topic!.operations).toContain(op);
            expect(has(topicId)).toBe(true);
          }
        }
      }
    }
  });

  it('grade 3 "·" easy is the small times table only (at most 10 · 10)', () => {
    for (const task of arithmeticTasks(3, 'mul', 'easy')) {
      // „7 · 8 = ?“ oder „□ · 6 = 54“: Faktoren höchstens 10, Ergebnis höchstens 100
      const [left, right] = task.prompt.math.value.split(' = ');
      expect(numbersIn(left).every((n) => n <= 10), task.prompt.math.value).toBe(true);
      expect(numbersIn(right).every((n) => n <= 100), task.prompt.math.value).toBe(true);
    }
  });

  it('grade 3 ":" easy has no remainder and stays within the times table', () => {
    for (const task of arithmeticTasks(3, 'div', 'easy')) {
      expect(task.topicId).toBe('k2-div');
      expect(numbersIn(task.prompt.math.value).every((n) => n <= 100)).toBe(true);
    }
  });

  it('grade 3 "+" easy changes only one place value (345 + 30) or adds hundreds', () => {
    for (const task of arithmeticTasks(3, 'add', 'easy').filter((t) => t.topicId === 'k3-add-1000')) {
      const [, b] = numbersIn(task.prompt.math.value);
      const nonZeroDigits = String(b).split('').filter((d) => d !== '0').length;
      expect(nonZeroDigits).toBe(1);
    }
  });

  const RANGES: Record<number, number> = { 1: 20, 2: 100, 3: 1000, 4: 1_000_000 };
  for (const grade of [1, 2, 3, 4] as Grade[]) {
    it(`grade ${grade} stays within its number range for every operation and level`, () => {
      for (const op of availableOperations(grade, has)) {
        for (const d of DIFFICULTIES) {
          for (const task of arithmeticTasks(grade, op, d, 100)) {
            const numbers = [...numbersIn(task.prompt.math.value), ...task.choices.flatMap((c) => numbersIn(c.display.value))];
            expect(Math.max(...numbers), `${op}/${d}: ${task.prompt.math.value}`).toBeLessThanOrEqual(RANGES[grade]);
          }
        }
      }
    });
  }

  it('grade 1 easy stays within 10', () => {
    for (const op of ['add', 'sub'] as Operation[]) {
      for (const task of arithmeticTasks(1, op, 'easy')) {
        expect(Math.max(...numbersIn(task.prompt.math.value))).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe('topic pool', () => {
  it('uses the highest grade that practices the operation from grade 5 on', () => {
    const pool = arithmeticPool(6, ['add'], 'medium', has).map((e) => e.topic.id).sort();
    expect(pool).toEqual(['k6-decimal-add-sub', 'k6-fraction-add-sub']);
    expect(arithmeticPool(6, ['add'], 'medium', has).every((e) => e.difficulty === 'medium')).toBe(true);
  });

  it('falls back to earlier grades when a grade has no generators yet', () => {
    const pool = arithmeticPool(12, ['sub'], 'easy', (id) => id.startsWith('k4'));
    expect(pool.map((e) => e.topic.id)).toEqual(['k4-written-add-sub']);
  });

  it('offers only operations that exist for the grade', () => {
    expect(availableOperations(1, has)).toEqual(['add', 'sub']);
    expect(availableOperations(2, has)).toEqual(['add', 'sub', 'mul', 'div']);
  });

  it('preselects the ready topics of the grade (or the closest earlier grade)', () => {
    expect(defaultTopicSelection(1, has)).toContain('k1-compare');
    expect(defaultTopicSelection(1, has).every((id) => id.startsWith('k1-'))).toBe(true);
    expect(defaultTopicSelection(9, (id) => id.startsWith('k4')).every((id) => id.startsWith('k4-'))).toBe(true);
  });

  it('keeps only chosen, ready topics up to the grade in topics mode', () => {
    const pool = poolFor(
      {
        grade: 2,
        mode: 'topics',
        operations: [],
        topicIds: ['k1-compare', 'k2-money', 'k3-units', 'k9-roots'],
        difficulty: 'hard',
        timer: { mode: 'off' },
        taskCount: 10,
      },
      has,
    );
    expect(pool.map((e) => e.topic.id)).toEqual(['k1-compare', 'k2-money']);
    expect(pool.every((e) => e.difficulty === 'hard')).toBe(true);
  });
});

describe('quiz config', () => {
  it('suggests more time for higher grades and harder levels', () => {
    expect(suggestedTaskSeconds(1, 'easy')).toBe(10);
    expect(suggestedTaskSeconds(4, 'hard')).toBe(30);
    expect(suggestedTaskSeconds(12, 'hard')).toBe(90);
  });

  it('awards stars by accuracy', () => {
    expect(starsFor(9, 10)).toBe(3);
    expect(starsFor(7, 10)).toBe(2);
    expect(starsFor(5, 10)).toBe(1);
    expect(starsFor(4, 10)).toBe(0);
    expect(starsFor(0, 0)).toBe(0);
  });

  it('formats durations', () => {
    expect(formatDuration(42_400)).toBe('42 s');
    expect(formatDuration(125_000)).toBe('2:05 min');
  });
});

describe('lesson pool', () => {
  it('uses exactly one level of the lesson topic', () => {
    const pool = poolFor(lessonSettings(3, 'k3-add-1000', 'medium'), has);
    expect(pool.map((e) => [e.topic.id, e.difficulty])).toEqual([['k3-add-1000', 'medium']]);
  });

  it('mixes all three levels in the test, without timer', () => {
    const settings = lessonSettings(3, 'k3-add-1000', 'test');
    expect(poolFor(settings, has).map((e) => e.difficulty)).toEqual(['easy', 'medium', 'hard']);
    expect(settings.timer).toEqual({ mode: 'off' });
    expect(settings.taskCount).toBe(10);
  });

  it('is empty for unknown topics', () => {
    expect(poolFor(lessonSettings(3, 'gibt-es-nicht', 'easy'), has)).toEqual([]);
  });
});
