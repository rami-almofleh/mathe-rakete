import { plain } from '../../models';
import { Rational } from '../../math/rational';
import { Rng } from '../../math/rng';
import { textAnswer } from '../answers';
import { Answer, GeneratedTask, TaskGenerator } from '../generator';
import { additionTask, subtractionTask } from './arithmetic';
import { roundingTask } from './grade-4';
import {
  borrowCount,
  byDifficulty,
  carryCount,
  digitsOf,
  DIVIDED,
  expr,
  generator,
  integerTask,
  MINUS,
  PLUS,
  sample,
  TIMES,
} from './helpers';
import { timePointTask, timeSpanTask } from './time';
import { change, changeForSeveral, classes, distanceLeft, share, visitors, wordProblemTask } from './word-problems';
import { compareTask, completeTask, neighborTask, placeValueByDifficulty, successorByBoundary } from './number-sense';
import { bigToSmall, formatComma, formatMixed, formatSmall, mixedToSmall, smallToBig, smallToMixed, unitTask, UnitSystem, UNITS } from './units';

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

// ---- Zahlen bis 1 000 -----------------------------------------------------------------------

export const k3PlaceValue = generator('k3-place-value', ({ difficulty, rng }) =>
  placeValueByDifficulty(rng, difficulty, { places: ['H', 'Z', 'E'], max: MAX_1000 }),
);

export const k3Neighbors = generator('k3-neighbors', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    // Vorgänger und Nachfolger – gern an der Grenze (399 → 400)
    easy: () => successorByBoundary(rng, MAX_1000),
    // Nachbarzehner bzw. Nachbarhunderter: ? < 347 < 350
    medium: () => neighborTask(rng, 10, 101, MAX_1000),
    hard: () => neighborTask(rng, 100, 101, MAX_1000),
  }),
);

export const k3Compare = generator('k3-compare', ({ difficulty, rng }) => compareTask(rng, difficulty, { min: 100, max: MAX_1000, step: 1 }));

export const k3Rounding = generator('k3-rounding', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    easy: () => roundingTask(rng, 10, 3, 'any', MAX_1000),
    medium: () => roundingTask(rng, 100, 3, 'any', MAX_1000),
    // Grenzfälle: genau 5 an der Rundungsstelle, oder Übertrag über die 9 (397 → 400)
    hard: () => roundingTask(rng, rng.pick([10, 100]), 3, rng.pick(['five', 'chain'] as const), MAX_1000),
  }),
);

// ---- Plus und Minus: Ergänzen --------------------------------------------------------------------

export const k3Complete = generator('k3-complete', ({ difficulty, rng }) => {
  const [n, target] = byDifficulty<[number, number]>(difficulty, {
    // bis zum nächsten Hunderter: 457 + □ = 500
    easy: () => {
      const n = sample(rng, (r) => r.int(101, 989), (n) => n % 100 !== 0);
      return [n, Math.ceil(n / 100) * 100];
    },
    // Zehnerzahl bis 1 000: 640 + □ = 1 000
    medium: () => [sample(rng, (r) => r.int(11, 99) * 10, (n) => n % 100 !== 0), MAX_1000],
    // beliebig bis 1 000 oder bis zu einem späteren Hunderter: 376 + □ = 700
    hard: () => {
      const n = sample(rng, (r) => r.int(101, 889), (n) => n % 10 !== 0);
      const firstHundred = Math.ceil(n / 100) + 1;
      return [n, firstHundred > 9 || rng.chance(0.5) ? MAX_1000 : rng.int(firstHundred, 9) * 100];
    },
  });
  return completeTask(n, target, MAX_1000);
});

// ---- Mal und geteilt: halbschriftlich teilen -------------------------------------------------------

export const k3DivHalfwritten = generator('k3-div-halfwritten', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    // Zehnerzahlen: 240 : 6 = 40, weil 24 : 6 = 4
    easy: () => {
      const [d, q] = sample(rng, (r) => [r.int(2, 9), r.int(2, 9)], ([d, q]) => d * q * 10 < MAX_1000);
      const dividend = d * q * 10;
      return integerTask({
        prompt: expr(dividend, DIVIDED, d, '=', '?'),
        answer: q * 10,
        // Null vergessen, eine Null zu viel, Nachbarergebnis
        distractors: [q, q * 100, (q + 1) * 10, (q - 1) * 10],
        explanation: [expr(dividend / 10, DIVIDED, d, '=', q), `Also: ${expr(dividend, DIVIDED, d, '=', q * 10)}`],
        max: MAX_1000,
      });
    },
    // jede Stelle einzeln teilbar: 84 : 4 = 80 : 4 + 4 : 4
    medium: () => {
      const [d, q] = sample(
        rng,
        (r) => [r.int(2, 4), r.int(11, 333)],
        ([d, q]) => q % 10 !== 0 && digitsOf(q).every((digit) => digit * d < 10) && d * q < MAX_1000,
      );
      return halfwrittenTask(d * q, d);
    },
    // mit Umbündeln: 96 : 4 = 80 : 4 + 16 : 4
    hard: () => {
      const [d, q] = sample(
        rng,
        (r) => [r.int(3, 9), r.int(12, 99)],
        ([d, q]) => q % 10 !== 0 && Math.floor((d * q) / 10) % d !== 0 && d * q < MAX_1000,
      );
      return halfwrittenTask(d * q, d);
    },
  }),
);

/** Aufteilen in einen großen, leicht teilbaren Teil (Zehner des Ergebnisses) und den Rest. */
function halfwrittenTask(dividend: number, d: number): GeneratedTask {
  const q = dividend / d;
  const big = Math.floor(q / 10) * 10 * d;
  const rest = dividend - big;
  return integerTask({
    prompt: expr(dividend, DIVIDED, d, '=', '?'),
    answer: q,
    // nur den ersten Teil gerechnet, verrechnet
    distractors: [big / d, rest / d, q + 1, q - 1, q + 10, q - 10],
    explanation: [expr(dividend, DIVIDED, d, '=', big, DIVIDED, d, PLUS, rest, DIVIDED, d), expr(big / d, PLUS, rest / d, '=', q)],
    max: MAX_1000,
  });
}

// ---- Größen ---------------------------------------------------------------------------------------

const LENGTH_UNITS: readonly UnitSystem[] = [UNITS.cmMm, UNITS.mCm, UNITS.kmM];

export const k3LengthUnits = generator('k3-length-units', ({ difficulty, rng }) => {
  const sys = rng.pick(LENGTH_UNITS);
  return byDifficulty(difficulty, {
    easy: () => (rng.chance(0.5) ? bigToSmall(sys, rng, 9) : smallToBig(sys, rng, 9)),
    medium: () => mixedToSmall(sys, rng, 9),
    hard: () => (rng.chance(0.5) ? smallToMixed(sys, rng, 9, false) : mixedToSmall(sys, rng, 9, false)),
  });
});

export const k3WeightUnits = generator('k3-weight-units', ({ difficulty, rng }) => {
  const sys = UNITS.kgG;
  return byDifficulty(difficulty, {
    easy: () => (rng.chance(0.5) ? bigToSmall(sys, rng, 9) : smallToBig(sys, rng, 9)),
    medium: () => mixedToSmall(sys, rng, 9),
    hard: () => {
      if (rng.chance(0.5)) return smallToMixed(sys, rng, 9, false);
      // 1 kg − 250 g = ? g
      const kg = rng.int(1, 3);
      const minus = 50 * rng.int(1, kg * 20 - 1);
      const answer = kg * 1000 - minus;
      return unitTask({
        prompt: `${kg} kg ${MINUS} ${formatSmall(minus, sys)} = ? g`,
        sys,
        answer,
        // 1 kg = 100 g gedacht, nicht umgerechnet, verrechnet
        distractors: [kg * 100 - minus, minus, answer + 100, answer - 100, answer + 50].filter((v) => v > 0),
        display: (t) => formatSmall(t.num / t.den, sys),
        explanation: [`${kg} kg = ${formatSmall(kg * 1000, sys)}`, `${formatSmall(kg * 1000, sys)} ${MINUS} ${formatSmall(minus, sys)} = ${formatSmall(answer, sys)}`],
      });
    },
  });
});

export const k3TimeSpan = generator('k3-time-span', ({ difficulty, rng }) => {
  const [start, duration] = byDifficulty<[number, number]>(difficulty, {
    // in derselben Stunde: 8:10 Uhr → 8:45 Uhr
    easy: () => {
      const h = rng.int(7, 17);
      const m1 = 5 * rng.int(0, 9);
      return [h * 60 + m1, 5 * rng.int(1, 11 - m1 / 5)];
    },
    // über die volle Stunde, höchstens 1 h: 8:40 Uhr → 9:15 Uhr
    medium: () => {
      const start = rng.int(7, 17) * 60 + 5 * rng.int(6, 11);
      const toHour = 60 - (start % 60);
      return [start, toHour + 5 * rng.int(1, (60 - toHour) / 5)];
    },
    // länger als eine Stunde: 7:40 Uhr → 9:05 Uhr
    hard: () => [rng.int(7, 16) * 60 + 5 * rng.int(1, 11), 5 * rng.int(13, 35)],
  });
  return timeSpanTask(start, duration);
});

export const k3TimePoint = generator('k3-time-point', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    // Viertel- und halbe Stunden: 8:15 Uhr + 30 min
    easy: () => timePointTask(rng.int(7, 17) * 60 + 15 * rng.int(0, 3), 15 * rng.int(1, 3)),
    // über die volle Stunde: 8:40 Uhr + 35 min
    medium: () => {
      const start = rng.int(7, 17) * 60 + 5 * rng.int(4, 11);
      return timePointTask(start, 5 * rng.int((65 - (start % 60)) / 5, 11));
    },
    // mit Stunden vorwärts oder über die volle Stunde zurück: 9:05 Uhr − 20 min
    hard: () => {
      if (rng.chance(0.5)) return timePointTask(rng.int(7, 15) * 60 + 5 * rng.int(1, 11), 60 * rng.int(1, 2) + 5 * rng.int(1, 11));
      const start = rng.int(8, 18) * 60 + 5 * rng.int(0, 7);
      return timePointTask(start, -5 * rng.int((start % 60) / 5 + 1, 11));
    },
  }),
);

// ---- Geld mit Komma ---------------------------------------------------------------------------------

/** 450 → „4,50 €“ */
const euro = (ct: number) => formatComma(Rational.of(ct), UNITS.euroCt);

export const k3Money = generator('k3-money', ({ difficulty, rng }) => {
  const add = rng.chance(0.5);
  const terms = byDifficulty<number[]>(difficulty, {
    // 3,20 € + 2,50 € · 6,80 € − 2,30 € (Cent ohne Übertrag)
    easy: () =>
      add
        ? sample(rng, (r) => [r.int(1, 9) * 100 + r.int(1, 8) * 10, r.int(1, 9) * 100 + r.int(1, 8) * 10], ([a, b]) => (a % 100) + (b % 100) < 100)
        : sample(rng, (r) => [r.int(3, 9) * 100 + r.int(2, 9) * 10, r.int(1, 2) * 100 + r.int(1, 8) * 10], ([a, b]) => a % 100 > b % 100),
    // 4,55 € + 2,80 € (Cent-Übertrag) · 5,00 € − 2,40 €
    medium: () =>
      add
        ? sample(rng, (r) => [r.int(1, 9) * 100 + r.int(2, 19) * 5, r.int(1, 9) * 100 + r.int(2, 19) * 5], ([a, b]) => (a % 100) + (b % 100) > 100)
        : [rng.int(3, 10) * 100, rng.int(1, 2) * 100 + rng.int(1, 19) * 5],
    // 20,00 € − 13,45 € · drei Beträge
    hard: () =>
      add
        ? sample(rng, (r) => [1, 2, 3].map(() => r.int(0, 5) * 100 + r.int(1, 19) * 5), (t) => t.reduce((x, y) => x + y) % 100 !== 0 && t.every((v) => v >= 50))
        : (() => {
            const paid = rng.pick([1000, 2000, 5000]);
            return [paid, sample(rng, (r) => r.int(paid / 200, paid / 100 - 1) * 100 + r.int(1, 19) * 5, (p) => p < paid)];
          })(),
  });
  const result = add ? terms.reduce((x, y) => x + y, 0) : terms[0] - terms[1];
  const sign = add ? PLUS : MINUS;
  const centsCarry = add && terms.reduce((x, y) => x + (y % 100), 0) >= 100;
  const borrow = !add && terms[0] % 100 < terms[1] % 100;
  return unitTask({
    prompt: `${terms.map(euro).join(` ${sign} `)} = ?`,
    sys: UNITS.euroCt,
    answer: result,
    distractors: [
      ...(centsCarry ? [result - 100] : []), // 100 ct = 1 € nicht übertragen
      ...(borrow ? [result + 100] : []), // Euro nicht entbündelt
      ...(terms.length === 3 ? [terms[0] + terms[1]] : []), // einen Betrag vergessen
      result + 10,
      result - 10,
      result + 5,
      result + 100,
    ].filter((v) => v > 0),
    display: (t) => euro(t.num / t.den),
    explanation: [
      `In Cent: ${terms.map((t) => `${expr(t)} ct`).join(` ${sign} `)}`,
      `${expr(...terms.flatMap((t, i) => (i ? [sign, t] : [t])), '=', result)} ct`,
      `${expr(result)} ct = ${euro(result)}`,
    ],
  });
});

export const k3WordProblems = generator('k3-word-problems', ({ difficulty, rng }) =>
  wordProblemTask(
    rng,
    byDifficulty(difficulty, {
      easy: () => [change, distanceLeft, visitors(100, MAX_1000)],
      medium: () => [classes, share, change, distanceLeft],
      hard: () => [changeForSeveral, classes, share, visitors(100, MAX_1000)],
    }),
    MAX_1000,
  ),
);

export const GRADE_3_GENERATORS: readonly TaskGenerator[] = [
  k3PlaceValue,
  k3Neighbors,
  k3Compare,
  k3Rounding,
  k3Add1000,
  k3Sub1000,
  k3Complete,
  k3TimesTens,
  k3DivRemainder,
  k3DivHalfwritten,
  k3LengthUnits,
  k3WeightUnits,
  k3TimeSpan,
  k3TimePoint,
  k3Units,
  k3Money,
  k3WordProblems,
];
