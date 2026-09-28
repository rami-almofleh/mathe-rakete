import { plain } from '../../models';
import { Rng } from '../../math/rng';
import { textAnswer } from '../answers';
import { GeneratedTask, TaskGenerator } from '../generator';
import { additionTask, subtractionTask } from './arithmetic';
import {
  borrowCount,
  BOX,
  byDifficulty,
  carryCount,
  expr,
  generator,
  integerTask,
  MINUS,
  pickOperation,
  PLUS,
  sample,
} from './helpers';

const MAX_10 = 10;
const MAX_20 = 20;

/** a + b + c = ? */
function threeAddends(rng: Rng, minSum: number, maxSum: number): GeneratedTask {
  const [a, b, c] = sample(
    rng,
    (r) => [r.int(1, 9), r.int(1, 9), r.int(1, 9)],
    ([a, b, c]) => a + b + c >= minSum && a + b + c <= maxSum,
  );
  const sum = a + b + c;
  return integerTask({
    prompt: expr(a, PLUS, b, PLUS, c, '=', '?'),
    answer: sum,
    // ein Summand vergessen, verzählt
    distractors: [a + b, b + c, a + c, sum + 1, sum - 1],
    explanation: [expr(a, PLUS, b, '=', a + b), expr(a + b, PLUS, c, '=', sum)],
    max: maxSum,
  });
}

/** a − b − c = ? */
function threeTermSubtraction(rng: Rng, minStart: number, maxStart: number, needsCrossing: boolean): GeneratedTask {
  const [a, b, c] = sample(
    rng,
    (r) => [r.int(minStart, maxStart), r.int(1, 9), r.int(1, 9)],
    ([a, b, c]) => a - b - c >= 0 && (!needsCrossing || borrowCount(a, b) + borrowCount(a - b, c) > 0),
  );
  const diff = a - b - c;
  return integerTask({
    prompt: expr(a, MINUS, b, MINUS, c, '=', '?'),
    answer: diff,
    // letzte Zahl vergessen, Vorzeichen verwechselt (a − b + c), verzählt
    distractors: [a - b, a - c, a - b + c, diff + 1, diff - 1],
    explanation: [expr(a, MINUS, b, '=', a - b), expr(a - b, MINUS, c, '=', diff)],
    max: maxStart,
  });
}

export const k1Add10 = generator('k1-add-10', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    easy: () => {
      const a = rng.int(1, 4);
      return additionTask(a, rng.int(1, 6 - a), MAX_10);
    },
    medium: () => {
      const a = rng.int(1, 9);
      return additionTask(a, rng.int(1, 10 - a), MAX_10);
    },
    hard: () => threeAddends(rng, 5, MAX_10),
  }),
);

export const k1Sub10 = generator('k1-sub-10', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    easy: () => {
      const a = rng.int(2, 6);
      return subtractionTask(a, rng.int(1, a - 1), MAX_10);
    },
    medium: () => {
      const a = rng.int(3, 10);
      return subtractionTask(a, rng.int(1, a), MAX_10);
    },
    hard: () => threeTermSubtraction(rng, 6, MAX_10, false),
  }),
);

export const k1Add20 = generator('k1-add-20', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    // ohne Zehnerübergang: 12 + 5
    easy: () => {
      const ones = rng.int(0, 8);
      const b = rng.int(1, 9 - ones);
      const a = 10 + ones;
      return rng.chance(0.5) ? additionTask(a, b, MAX_20) : additionTask(b, a, MAX_20);
    },
    // mit Zehnerübergang: 8 + 5
    medium: () => {
      const [a, b] = sample(rng, (r) => [r.int(2, 9), r.int(2, 9)], ([a, b]) => a + b > 10);
      return additionTask(a, b, MAX_20);
    },
    hard: () => threeAddends(rng, 11, MAX_20),
  }),
);

export const k1Sub20 = generator('k1-sub-20', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    // ohne Zehnerübergang: 17 − 4
    easy: () => {
      const ones = rng.int(1, 9);
      return subtractionTask(10 + ones, rng.int(1, ones), MAX_20);
    },
    // mit Zehnerübergang: 13 − 6
    medium: () => {
      const a = rng.int(11, 18);
      return subtractionTask(a, rng.int((a % 10) + 1, 9), MAX_20);
    },
    hard: () => threeTermSubtraction(rng, 11, MAX_20, true),
  }),
);

export const k1Missing = generator('k1-missing', (context) => {
  const { difficulty, rng } = context;
  const op = pickOperation(context, ['add', 'sub']);
  const limit = difficulty === 'easy' ? MAX_10 : MAX_20;
  const needsCrossing = difficulty === 'hard';

  if (op === 'add') {
    // unbekannter Summand x, bekannter Summand y
    const [x, y] = sample(
      rng,
      (r) => [r.int(1, limit - 1), r.int(1, limit - 1)],
      ([x, y]) => x + y <= limit && (!needsCrossing || carryCount(x, y) > 0),
    );
    const total = x + y;
    const boxFirst = difficulty !== 'easy' && rng.chance(0.5);
    return integerTask({
      prompt: boxFirst ? expr(BOX, PLUS, y, '=', total) : expr(y, PLUS, BOX, '=', total),
      answer: x,
      // addiert statt ergänzt, Ergebnis abgeschrieben, verzählt
      distractors: [total + y, total, x + 1, x - 1],
      explanation: [expr(BOX, '=', total, MINUS, y, '=', x), `Probe: ${expr(y, PLUS, x, '=', total)}`],
      max: MAX_20,
    });
  }

  const [minuend, subtrahend] = sample(
    rng,
    (r) => {
      const m = r.int(2, limit);
      return [m, r.int(1, m - 1)];
    },
    ([m, s]) => !needsCrossing || borrowCount(m, s) > 0,
  );
  const diff = minuend - subtrahend;
  if (difficulty !== 'easy' && rng.chance(0.5)) {
    // □ − s = d → □ = d + s
    return integerTask({
      prompt: expr(BOX, MINUS, subtrahend, '=', diff),
      answer: minuend,
      distractors: [diff - subtrahend, diff, minuend + 1, minuend - 1],
      explanation: [expr(BOX, '=', diff, PLUS, subtrahend, '=', minuend), `Probe: ${expr(minuend, MINUS, subtrahend, '=', diff)}`],
      max: MAX_20,
    });
  }
  // m − □ = d → □ = m − d
  return integerTask({
    prompt: expr(minuend, MINUS, BOX, '=', diff),
    answer: subtrahend,
    distractors: [minuend + diff, diff, subtrahend + 1, subtrahend - 1],
    explanation: [expr(BOX, '=', minuend, MINUS, diff, '=', subtrahend), `Probe: ${expr(minuend, MINUS, subtrahend, '=', diff)}`],
    max: MAX_20,
  });
});

export const k1DoubleHalf = generator('k1-double-half', ({ difficulty, rng }) => {
  const maxBase = difficulty === 'easy' ? 5 : 10;
  const n = rng.int(1, maxBase);
  const double = 2 * n;

  if (difficulty === 'hard') {
    return rng.chance(0.5)
      ? integerTask({
          prompt: `Das Doppelte von ${BOX} ist ${double}`,
          answer: n,
          distractors: [2 * double, n + 1, n - 1, double - 2],
          explanation: [expr(n, PLUS, n, '=', double), `Also ist ${BOX} = ${n}`],
          max: MAX_20,
        })
      : integerTask({
          prompt: `Die Hälfte von ${BOX} ist ${n}`,
          answer: double,
          distractors: [n + 2, double + 1, double - 1, double + 2],
          explanation: [expr(n, PLUS, n, '=', double), `Also ist ${BOX} = ${double}`],
          max: MAX_20,
        });
  }

  return rng.chance(0.5)
    ? integerTask({
        prompt: `Das Doppelte von ${n} ist ?`,
        answer: double,
        // „plus 2“ statt verdoppeln, verzählt
        distractors: [n + 2, double + 1, double - 1, n + 1],
        explanation: [expr(n, PLUS, n, '=', double)],
        max: MAX_20,
      })
    : integerTask({
        prompt: `Die Hälfte von ${double} ist ?`,
        answer: n,
        // verdoppelt statt halbiert, verzählt
        distractors: [2 * double, n + 1, n - 1, double - 2],
        explanation: [expr(n, PLUS, n, '=', double), `Also ist die Hälfte von ${double} gleich ${n}`],
        max: MAX_20,
      });
});

const RELATIONS = ['<', '>', '='] as const;
const RELATION_WORDS: Record<(typeof RELATIONS)[number], string> = {
  '<': 'ist kleiner als',
  '>': 'ist größer als',
  '=': 'ist gleich',
};

export const k1Compare = generator('k1-compare', ({ difficulty, rng }) => {
  const equal = rng.chance(difficulty === 'hard' ? 0.25 : 0.15);
  let leftText: string;
  let left: number;
  let right: number;
  const explanation: string[] = [];

  if (difficulty === 'hard') {
    const a = rng.int(2, 9);
    const b = rng.int(2, 9);
    left = a + b;
    leftText = expr(a, PLUS, b);
    explanation.push(expr(a, PLUS, b, '=', left));
    right = equal ? left : sample(rng, (r) => left + r.int(-2, 2), (v) => v !== left && v >= 0 && v <= MAX_20);
  } else {
    const max = difficulty === 'easy' ? MAX_10 : MAX_20;
    left = rng.int(0, max);
    const spread = difficulty === 'easy' ? max : 3;
    right = equal
      ? left
      : sample(rng, (r) => left + r.int(-spread, spread), (v) => v !== left && v >= 0 && v <= max);
    leftText = expr(left);
  }

  const relation = left < right ? '<' : left > right ? '>' : '=';
  explanation.push(`${left} ${RELATION_WORDS[relation]} ${right}`);
  const toAnswer = (r: string) => textAnswer(plain(r), r);
  return {
    prompt: { instruction: 'Welches Zeichen passt?', math: plain(`${leftText} ○ ${expr(right)}`) },
    answer: toAnswer(relation),
    distractors: RELATIONS.filter((r) => r !== relation).map(toAnswer),
    explanation: explanation.map(plain),
  };
});

export const GRADE_1_GENERATORS: readonly TaskGenerator[] = [
  k1Add10,
  k1Sub10,
  k1Add20,
  k1Sub20,
  k1Missing,
  k1DoubleHalf,
  k1Compare,
];
