import { plain, Task } from '../models';
import { Rational } from '../math/rational';
import { Rng } from '../math/rng';
import { numberAnswer } from './answers';
import { TaskGenerator } from './generator';
import { GeneratorRegistry } from './registry';
import { TaskFactory, tryCreateTask } from './task-factory';
import { fakeAdditionGenerator } from './testing/fake-generators';
import { validateTask } from './validate';

describe('GeneratorRegistry', () => {
  it('only accepts known topics, once', () => {
    const registry = new GeneratorRegistry([fakeAdditionGenerator()]);
    expect(registry.has('k1-add-10')).toBe(true);
    expect(() => registry.register(fakeAdditionGenerator())).toThrow();
    expect(() => registry.register(fakeAdditionGenerator('k99-nope'))).toThrow();
  });
});

describe('TaskFactory', () => {
  it('creates valid tasks with unique ids', () => {
    const factory = new TaskFactory(new GeneratorRegistry([fakeAdditionGenerator()]), new Rng(1));
    const ids = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const task = factory.create('k1-add-10', 'easy');
      ids.add(task.id);
      expect(task.grade).toBe(1);
      const correct = task.choices[task.correctIndex];
      const [a, b] = task.prompt.math.value.split(' = ')[0].split(' + ').map(Number);
      expect(correct.display.value).toBe(String(a + b));
      expect(validateTask(task, correct.key)).toEqual([]);
    }
    expect(ids.size).toBe(500);
  });

  it('retries until a valid task comes out', () => {
    let calls = 0;
    const flaky: TaskGenerator = {
      topicId: 'k1-add-10',
      generate: (ctx) => {
        calls++;
        if (calls < 3) throw new Error('kaputt');
        return fakeAdditionGenerator().generate(ctx);
      },
    };
    const factory = new TaskFactory(new GeneratorRegistry([flaky]), new Rng(1));
    expect(factory.create('k1-add-10', 'easy')).toBeTruthy();
    expect(calls).toBe(3);
  });

  it('rejects answers outside the number range of the grade', () => {
    const negative: TaskGenerator = {
      topicId: 'k1-sub-10',
      generate: () => ({
        prompt: { math: plain('3 − 5 = ?') },
        answer: numberAnswer(Rational.of(-2)),
        distractors: [numberAnswer(1), numberAnswer(2)],
      }),
    };
    const result = tryCreateTask(negative, { id: 'x', grade: 1, difficulty: 'easy', rng: new Rng(1) });
    expect(result.ok).toBe(false);

    const factory = new TaskFactory(new GeneratorRegistry([negative]), new Rng(1));
    expect(() => factory.create('k1-sub-10', 'easy')).toThrow(/Zahlenbereich/);
  });

  it('throws for topics without generator', () => {
    const factory = new TaskFactory(new GeneratorRegistry());
    expect(() => factory.create('k1-add-10', 'easy')).toThrow();
  });
});

describe('validateTask', () => {
  const base: Task = {
    id: '1',
    topicId: 'k1-add-10',
    grade: 1,
    difficulty: 'easy',
    prompt: { math: plain('2 + 2 = ?') },
    choices: [
      { display: plain('4'), key: 'n:4/1' },
      { display: plain('5'), key: 'n:5/1' },
      { display: plain('3'), key: 'n:3/1' },
    ],
    correctIndex: 0,
  };

  it('accepts a correct task', () => {
    expect(validateTask(base, 'n:4/1')).toEqual([]);
  });

  it('finds wrong index, duplicates and two correct answers', () => {
    expect(validateTask({ ...base, correctIndex: 1 }, 'n:4/1')).toContain('Richtige Antwort steht nicht an correctIndex');
    const duplicate: Task = { ...base, choices: [base.choices[0], base.choices[0], base.choices[2]] };
    const problems = validateTask(duplicate, 'n:4/1');
    expect(problems).toContain('Antworten mit gleichem Wert');
    expect(problems).toContain('2 richtige Antworten statt 1');
  });
});
