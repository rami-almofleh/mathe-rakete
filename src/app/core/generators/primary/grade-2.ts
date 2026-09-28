import { TaskGenerator } from '../generator';
import { additionTask, divisionTask, multiplicationTask, subtractionTask } from './arithmetic';
import {
  borrowCount,
  BOX,
  byDifficulty,
  carryCount,
  DIVIDED,
  explainTimesTable,
  expr,
  generator,
  integerTask,
  MINUS,
  pickOperation,
  PLUS,
  sample,
  TIMES,
} from './helpers';
import { bigToSmall, formatMixed, mixedToSmall, smallToBig, smallToMixed, unitTask, UNITS } from './units';

const MAX_100 = 100;
const CORE_FACTORS = [1, 2, 5, 10];

export const k2Add100 = generator('k2-add-100', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    // 30 + 40 · 34 + 5 · 34 + 20 (ohne Übergang)
    easy: () =>
      rng.pick([
        () => {
          const a = rng.int(1, 8);
          return additionTask(a * 10, rng.int(1, 9 - a) * 10, MAX_100);
        },
        () => {
          const a = sample(rng, (r) => r.int(11, 88), (n) => n % 10 < 9);
          return additionTask(a, rng.int(1, 9 - (a % 10)), MAX_100);
        },
        () => {
          const a = rng.int(11, 79);
          return additionTask(a, rng.int(1, 9 - Math.floor(a / 10)) * 10, MAX_100);
        },
      ])(),
    // 47 + 8 (Übergang) · 34 + 25 (ohne Übergang, zweistellig)
    medium: () =>
      rng.chance(0.5)
        ? (() => {
            const [a, b] = sample(rng, (r) => [r.int(11, 89), r.int(2, 9)], ([a, b]) => carryCount(a, b) > 0 && a + b <= MAX_100);
            return additionTask(a, b, MAX_100);
          })()
        : (() => {
            const [a, b] = sample(rng, (r) => [r.int(11, 79), r.int(11, 79)], ([a, b]) => carryCount(a, b) === 0 && a + b < MAX_100);
            return additionTask(a, b, MAX_100);
          })(),
    // 47 + 38 (Übergang bei den Einern)
    hard: () => {
      const [a, b] = sample(rng, (r) => [r.int(11, 89), r.int(11, 89)], ([a, b]) => (a % 10) + (b % 10) >= 10 && a + b <= MAX_100);
      return additionTask(a, b, MAX_100);
    },
  }),
);

export const k2Sub100 = generator('k2-sub-100', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    // 70 − 30 · 58 − 6 · 58 − 20 (ohne Übergang)
    easy: () =>
      rng.pick([
        () => {
          const a = rng.int(2, 10);
          return subtractionTask(a * 10, rng.int(1, a - 1) * 10, MAX_100);
        },
        () => {
          const a = sample(rng, (r) => r.int(11, 99), (n) => n % 10 > 0);
          return subtractionTask(a, rng.int(1, a % 10), MAX_100);
        },
        () => {
          const a = rng.int(21, 99);
          return subtractionTask(a, rng.int(1, Math.floor(a / 10) - 1) * 10, MAX_100);
        },
      ])(),
    // 52 − 7 (Übergang) · 58 − 23 (ohne Übergang)
    medium: () =>
      rng.chance(0.5)
        ? (() => {
            const [a, b] = sample(rng, (r) => [r.int(11, 99), r.int(2, 9)], ([a, b]) => borrowCount(a, b) > 0);
            return subtractionTask(a, b, MAX_100);
          })()
        : (() => {
            const [a, b] = sample(rng, (r) => [r.int(22, 99), r.int(11, 89)], ([a, b]) => a > b && borrowCount(a, b) === 0);
            return subtractionTask(a, b, MAX_100);
          })(),
    // 82 − 45
    hard: () => {
      const [a, b] = sample(rng, (r) => [r.int(21, 100), r.int(11, 89)], ([a, b]) => a - b >= 2 && borrowCount(a, b) > 0);
      return subtractionTask(a, b, MAX_100);
    },
  }),
);

export const k2TimesTable = generator('k2-times-table', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    // Kernaufgaben mit 1, 2, 5, 10
    easy: () => {
      const core = rng.pick(CORE_FACTORS);
      const other = rng.int(1, 10);
      return rng.chance(0.5) ? multiplicationTask(core, other, MAX_100) : multiplicationTask(other, core, MAX_100);
    },
    medium: () => multiplicationTask(rng.int(2, 10), rng.int(2, 10), MAX_100),
    hard: () => {
      const a = rng.int(6, 9);
      const b = rng.int(6, 9);
      if (rng.chance(0.5)) {
        return multiplicationTask(a, b, MAX_100);
      }
      // □ · b = c
      const product = a * b;
      return integerTask({
        prompt: expr(BOX, TIMES, b, '=', product),
        answer: a,
        // Nachbar in der Reihe, bekannten Faktor abgeschrieben
        distractors: [a + 1, a - 1, a + 2, b],
        explanation: [expr(BOX, '=', product, DIVIDED, b, '=', a), ...explainTimesTable(a, b)],
        max: MAX_100,
      });
    },
  }),
);

export const k2Div = generator('k2-div', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    easy: () => {
      const divisor = rng.pick([2, 5, 10]);
      return divisionTask(divisor * rng.int(1, 10), divisor, MAX_100);
    },
    medium: () => {
      const divisor = rng.int(2, 10);
      return divisionTask(divisor * rng.int(2, 10), divisor, MAX_100);
    },
    hard: () => {
      const divisor = rng.int(3, 9);
      const quotient = rng.int(3, 10);
      const dividend = divisor * quotient;
      return rng.chance(0.5)
        ? integerTask({
            // □ : 6 = 7
            prompt: expr(BOX, DIVIDED, divisor, '=', quotient),
            answer: dividend,
            distractors: [dividend + divisor, dividend - divisor, quotient + divisor, dividend + 1],
            explanation: [expr(BOX, '=', quotient, TIMES, divisor, '=', dividend)],
            max: MAX_100,
          })
        : integerTask({
            // 42 : □ = 7
            prompt: expr(dividend, DIVIDED, BOX, '=', quotient),
            answer: divisor,
            distractors: [divisor + 1, divisor - 1, divisor + 2, quotient],
            explanation: [expr(BOX, '=', dividend, DIVIDED, quotient, '=', divisor) + `, denn ${expr(quotient, TIMES, divisor, '=', dividend)}`],
            max: MAX_100,
          });
    },
  }),
);

export const k2Money = generator('k2-money', (context) => {
  const { difficulty, rng } = context;
  const op = pickOperation(context, ['add', 'sub']);
  const sys = UNITS.euroCt;
  const money = (ct: number) => formatMixed(ct, sys);

  const [a, b] = byDifficulty(difficulty, {
    // 40 ct + 30 ct · 90 ct − 30 ct
    easy: () => sample(rng, (r) => [r.int(1, 9) * 10, r.int(1, 9) * 10], ([a, b]) => (op === 'add' ? a + b <= 100 : a > b)),
    // 45 ct + 35 ct · 1 € − 35 ct
    medium: () =>
      op === 'add'
        ? sample(rng, (r) => [r.int(1, 19) * 5, r.int(1, 19) * 5], ([a, b]) => a + b <= 100 && carryCount(a, b) > 0)
        : [100, rng.int(1, 19) * 5],
    // 2 € 50 ct + 1 € 80 ct · 5 € − 1 € 20 ct
    hard: () =>
      op === 'add'
        ? sample(rng, (r) => [r.int(11, 49) * 10, r.int(11, 49) * 10], ([a, b]) => (a % 100) + (b % 100) >= 100 && a + b <= 1000)
        : sample(rng, (r) => [r.int(2, 9) * 100, r.int(11, 49) * 10], ([a, b]) => a > b && b % 100 !== 0),
  });

  const result = op === 'add' ? a + b : a - b;
  const sign = op === 'add' ? PLUS : MINUS;
  const distractors = [result + 10, result - 10, result + 5, result - 5];
  if (op === 'add' && (a % 100) + (b % 100) >= 100) {
    distractors.push(result - 100); // Übertrag 100 ct = 1 € vergessen
  }
  if (op === 'sub' && a % 100 < b % 100) {
    distractors.push(result + 100); // 5 € − 1 € 20 ct → 4 € 80 ct (Euro nicht entbündelt)
  }
  if (op === 'sub' && a % 100 === 0) {
    distractors.push(subtractDigitwise(a, b));
  }
  return unitTask({
    prompt: `${money(a)} ${sign} ${money(b)} = ?`,
    sys,
    answer: result,
    distractors,
    display: (t) => money(t.num / t.den),
    explanation:
      Math.max(a, b, result) < 100
        ? [`${expr(a, sign, b, '=', result)} ct`]
        : [`1 € = 100 ct`, `${money(a)} ${sign} ${money(b)} = ${expr(a, sign, b, '=', result)} ct`, `${expr(result)} ct = ${money(result)}`],
  });
});

/** Fehler bei 1 € − 35 ct: „10 − 3 = 7, 5 − 0 = 5“ → 75 ct. */
function subtractDigitwise(a: number, b: number): number {
  const tens = Math.floor(b / 10) % 10;
  const ones = b % 10;
  return Math.max(0, Math.floor(a / 100) * 100 - 100 + (10 - tens) * 10 + ones);
}

export const k2Length = generator('k2-length', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    easy: () => (rng.chance(0.5) ? bigToSmall(UNITS.mCm, rng, 9) : smallToBig(UNITS.mCm, rng, 9)),
    medium: () => mixedToSmall(UNITS.mCm, rng, 9),
    hard: () => smallToMixed(UNITS.mCm, rng, 9, false),
  }),
);

export const GRADE_2_GENERATORS: readonly TaskGenerator[] = [k2Add100, k2Sub100, k2TimesTable, k2Div, k2Money, k2Length];
