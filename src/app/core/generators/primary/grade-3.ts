import { plain } from '../../models';
import { Rng } from '../../math/rng';
import { textAnswer } from '../answers';
import { Answer, TaskGenerator } from '../generator';
import { additionTask, subtractionTask } from './arithmetic';
import { borrowCount, byDifficulty, carryCount, DIVIDED, expr, generator, integerTask, MINUS, PLUS, sample, TIMES } from './helpers';
import { bigToSmall, mixedToSmall, smallToBig, smallToMixed, UnitSystem, UNITS } from './units';

const MAX_1000 = 1000;

/** Zweistellig oder dreistellig, je nach Wahl. */
function twoOrThree(rng: Rng): number {
  return rng.chance(0.5) ? rng.int(11, 99) : rng.int(101, 899);
}

/** Zahl mit nur einem Stellenwert: 3, 30 oder 300. */
function singlePlace(rng: Rng): number {
  return rng.int(1, 9) * rng.pick([1, 10, 100]);
}

/**
 * Stufen wie im Schulbuch:
 * einfach – 300 + 400, 345 + 30, 345 + 200 (nur ein Stellenwert, ohne Übertrag)
 * mittel  – 413 + 556 (alle Stellen, ohne Übertrag) oder genau ein Übertrag
 * schwer  – mehrere Überträge, z. B. 456 + 278
 */
export const k3Add1000 = generator('k3-add-1000', ({ difficulty, rng }) => {
  const [a, b] = byDifficulty<[number, number]>(difficulty, {
    easy: () => {
      if (rng.chance(0.3)) {
        const h = rng.int(1, 8);
        return [h * 100, rng.int(1, 9 - h) * 100];
      }
      return sample(rng, (r) => [r.int(101, 899), singlePlace(r)], ([a, b]) => carryCount(a, b) === 0 && a + b < MAX_1000);
    },
    medium: () =>
      rng.chance(0.5)
        ? sample(rng, (r) => [r.int(101, 899), r.int(101, 899)], ([a, b]) => carryCount(a, b) === 0 && a + b < MAX_1000)
        : sample(rng, (r) => [r.int(101, 899), twoOrThree(r)], ([a, b]) => carryCount(a, b) === 1 && a + b <= MAX_1000),
    hard: () => sample(rng, (r) => [r.int(101, 899), r.int(101, 899)], ([a, b]) => carryCount(a, b) >= 2 && a + b <= MAX_1000),
  });
  return additionTask(a, b, MAX_1000);
});

/**
 * einfach – 700 − 300, 745 − 30, 745 − 200 (nur ein Stellenwert, ohne Entbündeln)
 * mittel  – 876 − 453 (alle Stellen, ohne Entbündeln) oder genau einmal entbündeln
 * schwer  – mehrmals entbündeln, auch über die Null: 803 − 457
 */
export const k3Sub1000 = generator('k3-sub-1000', ({ difficulty, rng }) => {
  const [a, b] = byDifficulty<[number, number]>(difficulty, {
    easy: () => {
      if (rng.chance(0.3)) {
        const h = rng.int(2, 10);
        return [h * 100, rng.int(1, h - 1) * 100];
      }
      return sample(rng, (r) => [r.int(101, 999), singlePlace(r)], ([a, b]) => a - b >= 10 && borrowCount(a, b) === 0);
    },
    medium: () =>
      rng.chance(0.5)
        ? sample(rng, (r) => [r.int(200, 999), r.int(101, 899)], ([a, b]) => a - b >= 10 && borrowCount(a, b) === 0)
        : sample(rng, (r) => [r.int(200, 999), twoOrThree(r)], ([a, b]) => a - b >= 10 && borrowCount(a, b) === 1),
    hard: () => sample(rng, (r) => [r.int(200, MAX_1000), r.int(101, 899)], ([a, b]) => a - b >= 10 && borrowCount(a, b) >= 2),
  });
  return subtractionTask(a, b, MAX_1000);
});

export const k3TimesTens = generator('k3-times-tens', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    // 7 · 40
    easy: () => {
      const a = rng.int(2, 9);
      const tens = rng.int(2, 9);
      const [x, y] = rng.chance(0.5) ? [a, tens * 10] : [tens * 10, a];
      const product = a * tens * 10;
      return integerTask({
        prompt: expr(x, TIMES, y, '=', '?'),
        answer: product,
        // Null vergessen, eine Null zu viel, Nachbaraufgabe, plus statt mal
        distractors: [product / 10, product * 10, product + tens * 10, product - tens * 10, x + y],
        explanation: [expr(a, TIMES, tens, '=', a * tens), expr(a * tens, TIMES, 10, '=', product)],
        max: MAX_1000,
      });
    },
    // 20 · 30 · 300 · 3
    medium: () => {
      if (rng.chance(0.5)) {
        const [a, b] = sample(rng, (r) => [r.int(2, 9), r.int(2, 9)], ([a, b]) => a * b <= 10);
        const product = a * b * 100;
        return integerTask({
          prompt: expr(a * 10, TIMES, b * 10, '=', '?'),
          answer: product,
          // nur eine Null angehängt, drei Nullen, plus statt mal (20 + 30 = 50)
          distractors: [product / 10, product * 10, (a + b) * 10],
          explanation: [expr(a, TIMES, b, '=', a * b), `Zwei Nullen anhängen: ${expr(a * 10, TIMES, b * 10, '=', product)}`],
          max: MAX_1000,
        });
      }
      const [h, d] = sample(rng, (r) => [r.int(1, 9), r.int(2, 9)], ([h, d]) => h * d <= 10);
      const product = h * d * 100;
      return integerTask({
        prompt: expr(h * 100, TIMES, d, '=', '?'),
        answer: product,
        distractors: [product / 10, product * 10, product + 100, h * 100 + d],
        explanation: [expr(h, TIMES, d, '=', h * d), expr(h * d, TIMES, 100, '=', product)],
        max: MAX_1000,
      });
    },
    // 47 · 8 halbschriftlich
    hard: () => {
      const [a, b] = sample(rng, (r) => [r.int(12, 99), r.int(3, 9)], ([a, b]) => a % 10 !== 0 && a * b <= MAX_1000);
      const tens = a - (a % 10);
      const ones = a % 10;
      const product = a * b;
      return integerTask({
        prompt: expr(a, TIMES, b, '=', '?'),
        answer: product,
        // Einer nicht mitmultipliziert, Nachbaraufgabe, Übertrag verrechnet
        distractors: [tens * b + ones, product + b, product - b, product + 10, product - 10],
        explanation: [expr(a, TIMES, b, '=', tens, TIMES, b, PLUS, ones, TIMES, b), expr(tens * b, PLUS, ones * b, '=', product)],
        max: MAX_1000,
      });
    },
  }),
);

function restAnswer(quotient: number, rest: number): Answer {
  return textAnswer(plain(`${quotient} Rest ${rest}`), `${quotient}r${rest}`);
}

export const k3DivRemainder = generator('k3-div-remainder', ({ difficulty, rng }) => {
  const [divisor, quotient] = byDifficulty(difficulty, {
    easy: () => [rng.int(2, 5), rng.int(2, 6)],
    medium: () => [rng.int(3, 9), rng.int(2, 9)],
    hard: () => sample(rng, (r) => [r.int(6, 9), r.int(5, 12)], ([d, q]) => d * q + d - 1 <= 100),
  });
  const rest = rng.int(1, divisor - 1);
  const dividend = divisor * quotient + rest;

  const wrong: Answer[] = [
    restAnswer(quotient - 1, rest + divisor), // Rest größer als der Teiler
    restAnswer(quotient + 1, rest),
    restAnswer(quotient - 1, rest),
  ];
  if (rest + 1 < divisor) wrong.push(restAnswer(quotient, rest + 1));
  if (rest > 1) wrong.push(restAnswer(quotient, rest - 1));

  return {
    prompt: { math: plain(expr(dividend, DIVIDED, divisor, '=', '?')) },
    answer: restAnswer(quotient, rest),
    distractors: wrong,
    fallback: (r) => {
      const q = quotient + r.pick([-2, -1, 1, 2]);
      if (q < 1) throw new RangeError('Quotient zu klein');
      return restAnswer(q, r.int(1, divisor - 1));
    },
    explanation: [
      expr(quotient, TIMES, divisor, '=', divisor * quotient),
      expr(dividend, MINUS, divisor * quotient, '=', rest),
      `${expr(dividend, DIVIDED, divisor, '=', quotient)} Rest ${rest}`,
    ].map(plain),
  };
});

const GRADE_3_UNITS: readonly { sys: UnitSystem; maxBig: number }[] = [
  { sys: UNITS.mCm, maxBig: 9 },
  { sys: UNITS.kmM, maxBig: 9 },
  { sys: UNITS.kgG, maxBig: 9 },
  { sys: UNITS.cmMm, maxBig: 9 },
  { sys: UNITS.hMin, maxBig: 3 },
];

export const k3Units = generator('k3-units', ({ difficulty, rng }) => {
  const { sys, maxBig } = rng.pick(GRADE_3_UNITS);
  return byDifficulty(difficulty, {
    easy: () => (rng.chance(0.5) ? bigToSmall(sys, rng, maxBig) : smallToBig(sys, rng, maxBig)),
    medium: () => mixedToSmall(sys, rng, maxBig),
    hard: () => (rng.chance(0.5) ? smallToMixed(sys, rng, maxBig, false) : mixedToSmall(sys, rng, maxBig, false)),
  });
});

export const GRADE_3_GENERATORS: readonly TaskGenerator[] = [k3Add1000, k3Sub1000, k3TimesTens, k3DivRemainder, k3Units];
