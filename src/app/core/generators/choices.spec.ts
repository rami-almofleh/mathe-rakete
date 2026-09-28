import { plain } from '../models';
import { Rational } from '../math/rational';
import { Rng } from '../math/rng';
import { answersFor, nearbyFallback, nearbyValue, numberFormat, textAnswer } from './answers';
import { buildChoices } from './choices';
import { defaultDomain } from './domain';
import { GeneratedTask } from './generator';

const format = numberFormat();
const primaryDomain = defaultDomain(2);

function task(answer: number, distractors: number[], withFallback = false): GeneratedTask {
  return {
    prompt: { math: plain('?') },
    answer: format(Rational.of(answer)),
    distractors: answersFor(distractors, format),
    fallback: withFallback ? nearbyFallback(Rational.of(answer), format) : undefined,
  };
}

describe('buildChoices', () => {
  it('returns the answer and two distractors from the error patterns', () => {
    const set = buildChoices(task(13, [3, 23]), primaryDomain, new Rng(1))!;
    expect(set.choices.map((c) => c.display.value).sort()).toEqual(['13', '23', '3']);
    expect(set.choices[set.correctIndex].key).toBe('n:13/1');
  });

  it('drops duplicates, the correct answer and values outside the domain', () => {
    // −1 ist in Kl. 2 nicht erlaubt, 13 ist die Lösung, 23 doppelt
    const set = buildChoices(task(13, [13, 23, 23, -1, 14]), primaryDomain, new Rng(2))!;
    const values = set.choices.map((c) => c.display.value).sort();
    expect(values).toEqual(['13', '14', '23']);
  });

  it('fills up with nearby values when patterns are not enough', () => {
    for (let seed = 0; seed < 200; seed++) {
      const set = buildChoices(task(0, [0], true), primaryDomain, new Rng(seed))!;
      expect(set).not.toBeNull();
      expect(new Set(set.choices.map((c) => c.key)).size).toBe(3);
      for (const c of set.choices) {
        expect(c.display.value.startsWith('−')).toBe(false);
      }
    }
  });

  it('gives up without enough distinct candidates', () => {
    expect(buildChoices(task(5, [6]), primaryDomain, new Rng(1))).toBeNull();
  });

  it('treats answers that look the same as duplicates', () => {
    const generated: GeneratedTask = {
      prompt: { math: plain('?') },
      answer: textAnswer(plain('7 Rest 1'), '7r1'),
      distractors: [textAnswer(plain('7 Rest 1'), 'other'), textAnswer(plain('6 Rest 5'), '6r5')],
    };
    expect(buildChoices(generated, primaryDomain, new Rng(1))).toBeNull();
  });

  it('spreads the correct answer over all positions', () => {
    const positions = new Set<number>();
    for (let seed = 0; seed < 50; seed++) {
      positions.add(buildChoices(task(13, [3, 23]), primaryDomain, new Rng(seed))!.correctIndex);
    }
    expect([...positions].sort()).toEqual([0, 1, 2]);
  });
});

describe('nearbyValue', () => {
  it('keeps the kind of number', () => {
    const rng = new Rng(5);
    for (let i = 0; i < 100; i++) {
      expect(nearbyValue(Rational.of(40), rng).isInteger()).toBe(true);
      expect(nearbyValue(Rational.decimal(345, 2), rng).decimalPlaces()).not.toBeNull();
      expect(nearbyValue(Rational.of(2, 3), rng).equals(Rational.of(2, 3))).toBe(false);
    }
  });
});
