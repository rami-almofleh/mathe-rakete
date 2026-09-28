import { Rng } from '../../math/rng';
import { GeneratedTask, TaskGenerator } from '../generator';
import {
  addWithoutCarry,
  borrowCount,
  byDifficulty,
  carryCount,
  DIVIDED,
  expr,
  generator,
  integerTask,
  MINUS,
  multiplyWithoutCarry,
  pickOperation,
  placeParts,
  PLUS,
  sample,
  subtractSmallerDigit,
  subtractWithoutBorrow,
  TIMES,
  withDigits,
} from './helpers';
import { commaToSmall, DECIMAL_UNITS, smallToComma, UNITS } from './units';

const MAX_MILLION = 1_000_000;

// ---- Schriftliche Addition und Subtraktion -----------------------------------------

function writtenAddition(rng: Rng, digits: number, minCarries: number, maxCarries: number): GeneratedTask {
  const [a, b] = sample(
    rng,
    (r) => [withDigits(r, digits), withDigits(r, r.chance(0.7) ? digits : digits - 1)],
    ([a, b]) => {
      const c = carryCount(a, b);
      return a + b <= MAX_MILLION && c >= minCarries && c <= maxCarries;
    },
  );
  const sum = a + b;
  return integerTask({
    prompt: expr(a, PLUS, b, '=', '?'),
    answer: sum,
    // Übertrag vergessen, Übertrag in die falsche Spalte
    distractors: [addWithoutCarry(a, b), sum - 10, sum + 10, sum - 100, sum + 100, sum - 1000],
    explanation: [expr(a, PLUS, b, '=', sum), `Probe: ${expr(sum, MINUS, b, '=', a)}`],
    max: MAX_MILLION,
  });
}

/** Zahl mit mindestens `zeros` Nullen (nicht vorne), z. B. 700 050. */
function withZeros(rng: Rng, digits: number, zeros: number): number {
  const d = Array.from({ length: digits }, (_, i) => (i === 0 ? rng.int(1, 9) : rng.int(0, 9)));
  const positions = rng.shuffle(Array.from({ length: digits - 1 }, (_, i) => i + 1)).slice(0, zeros);
  positions.forEach((p) => (d[p] = 0));
  return Number(d.join(''));
}

function writtenSubtraction(rng: Rng, digits: number, minBorrows: number, maxBorrows: number, zeros = 0): GeneratedTask {
  const [a, b] = sample(
    rng,
    (r) => [zeros ? withZeros(r, digits, zeros) : withDigits(r, digits), withDigits(r, r.chance(0.7) ? digits : digits - 1)],
    ([a, b]) => {
      if (a - b < 10 ** (digits - 2)) return false;
      const c = borrowCount(a, b);
      return c >= minBorrows && c <= maxBorrows;
    },
  );
  const diff = a - b;
  return integerTask({
    prompt: expr(a, MINUS, b, '=', '?'),
    answer: diff,
    // „kleinere von größerer Ziffer“, Entbündeln vergessen, in der falschen Spalte entbündelt
    distractors: [subtractSmallerDigit(a, b), subtractWithoutBorrow(a, b), diff + 10, diff - 10, diff + 100, diff + 1000],
    explanation: [expr(a, MINUS, b, '=', diff), `Probe: ${expr(diff, PLUS, b, '=', a)}`],
    max: MAX_MILLION,
  });
}

export const k4WrittenAddSub = generator('k4-written-add-sub', (context) => {
  const { difficulty, rng } = context;
  const op = pickOperation(context, ['add', 'sub']);
  return byDifficulty(difficulty, {
    easy: () => (op === 'add' ? writtenAddition(rng, 4, 1, 2) : writtenSubtraction(rng, 4, 1, 2)),
    medium: () => (op === 'add' ? writtenAddition(rng, 5, 2, 5) : writtenSubtraction(rng, 5, 2, 5)),
    // sechsstellig, viele Überträge; Minuend mit Nullen (700 050 − 348 276)
    hard: () => (op === 'add' ? writtenAddition(rng, 6, 3, 6) : writtenSubtraction(rng, 6, 3, 6, 2)),
  });
});

// ---- Schriftliche Multiplikation ---------------------------------------------------------

function sumLine(values: number[]): (number | string)[] {
  return values.flatMap((v, i) => (i ? [PLUS, v] : [v]));
}

function explainWrittenMultiplication(a: number, b: number): string[] {
  const product = a * b;
  const bParts = placeParts(b);
  if (bParts.length > 1) {
    // 347 · 26: 347 · 20 und 347 · 6, dann addieren
    return [...bParts.map((p) => expr(a, TIMES, p, '=', a * p)), expr(...sumLine(bParts.map((p) => a * p)), '=', product)];
  }
  const aParts = placeParts(a);
  if (aParts.length === 1) {
    return [expr(a, TIMES, b, '=', product)];
  }
  return [
    expr(a, TIMES, b, '=', ...aParts.flatMap((p, i) => (i ? [PLUS, p, TIMES, b] : [p, TIMES, b]))),
    expr(...sumLine(aParts.map((p) => p * b)), '=', product),
  ];
}

/** Fehler: Teilprodukte nicht eingerückt (347 · 26 → 347 · 2 + 347 · 6). */
function withoutShift(a: number, b: number): number {
  return String(b)
    .split('')
    .map(Number)
    .reduce((sum, digit) => sum + a * digit, 0);
}

export const k4WrittenMul = generator('k4-written-mul', ({ difficulty, rng }) => {
  const [a, b] = byDifficulty(difficulty, {
    easy: () => [withDigits(rng, 3), rng.int(3, 9)],
    medium: () => [withDigits(rng, 3), rng.int(12, 99)],
    hard: () =>
      sample(
        rng,
        (r) => (r.chance(0.5) ? [withDigits(r, 4), r.int(12, 99)] : [withDigits(r, 3), withDigits(r, 3)]),
        ([a, b]) => a * b < MAX_MILLION,
      ),
  });
  const product = a * b;
  const distractors = [product + a, product - a, product + 100, product - 100, product + 10];
  distractors.push(b < 10 ? multiplyWithoutCarry(a, b) : withoutShift(a, b));
  return integerTask({
    prompt: expr(a, TIMES, b, '=', '?'),
    answer: product,
    distractors,
    explanation: explainWrittenMultiplication(a, b),
    max: MAX_MILLION,
  });
});

// ---- Schriftliche Division ------------------------------------------------------------

export const k4WrittenDiv = generator('k4-written-div', ({ difficulty, rng }) => {
  const divisor = rng.int(2, 9);
  const quotient = byDifficulty(difficulty, {
    easy: () => sample(rng, (r) => r.int(12, 499), (q) => q * divisor >= 100 && q * divisor <= 999),
    medium: () => sample(rng, (r) => r.int(112, 4999), (q) => q * divisor >= 1000 && q * divisor <= 9999),
    // Null im Ergebnis, z. B. 5 628 : 4 = 1 407
    hard: () =>
      sample(
        rng,
        (r) => r.int(101, 9999),
        (q) => String(q).slice(0, -1).includes('0') && q * divisor >= 1000 && q * divisor <= 99_999,
      ),
  });
  const dividend = quotient * divisor;
  const withoutZeros = Number(String(quotient).replace(/0/g, ''));
  return integerTask({
    prompt: expr(dividend, DIVIDED, divisor, '=', '?'),
    answer: quotient,
    // Null im Ergebnis vergessen, eine Null zu viel, verrechnet
    distractors: [withoutZeros, quotient * 10, quotient + 1, quotient - 1, quotient + 10, quotient - 10],
    explanation: [expr(dividend, DIVIDED, divisor, '=', quotient), `Probe: ${expr(quotient, TIMES, divisor, '=', dividend)}`],
    max: MAX_MILLION,
  });
});

// ---- Runden und Überschlagen ---------------------------------------------------------

const PLACE_NAMES: Record<number, string> = { 10: 'Zehner', 100: 'Hunderter', 1000: 'Tausender', 10_000: 'Zehntausender' };

export function roundTo(n: number, place: number): number {
  return Math.round(n / place) * place;
}

function decisionDigit(n: number, place: number): number {
  return Math.floor(n / (place / 10)) % 10;
}

function roundingTask(rng: Rng, place: number, digits: number, mode: 'any' | 'five' | 'chain'): GeneratedTask {
  const n = sample(
    rng,
    (r) => withDigits(r, digits),
    (n) =>
      n % place !== 0 &&
      (mode !== 'five' || decisionDigit(n, place) === 5) &&
      (mode !== 'chain' || (Math.floor(n / place) % 10 === 9 && decisionDigit(n, place) >= 5)),
  );
  const rounded = roundTo(n, place);
  const down = Math.floor(n / place) * place;
  const up = down + place;
  const digit = decisionDigit(n, place);
  const distractors = [rounded === up ? down : up, roundTo(n, place * 10), rounded + place];
  if (place >= 100) {
    distractors.push(roundTo(n, place / 10));
  }
  return integerTask({
    instruction: `Runde auf ${PLACE_NAMES[place]}.`,
    prompt: `${expr(n)} ≈ ?`,
    answer: rounded,
    // falsche Richtung, falsche Stelle
    distractors,
    explanation: [
      `Die Ziffer rechts neben den ${PLACE_NAMES[place]}n ist ${digit}.`,
      digit >= 5 ? 'Bei 5, 6, 7, 8, 9 wird aufgerundet.' : 'Bei 0, 1, 2, 3, 4 wird abgerundet.',
      `${expr(n)} ≈ ${expr(rounded)}`,
    ],
    max: MAX_MILLION,
  });
}

function estimationTask(rng: Rng, op: 'add' | 'sub' | 'mul'): GeneratedTask {
  const place = op === 'mul' ? 10 : 100;
  const [a, b] = sample(
    rng,
    (r) => (op === 'mul' ? [r.int(11, 99), r.int(11, 99)] : [withDigits(r, 4), withDigits(r, 4)]),
    ([a, b]) =>
      a % place !== 0 && b % place !== 0 && (op !== 'sub' || roundTo(a, place) - roundTo(b, place) >= 2 * place),
  );
  const ra = roundTo(a, place);
  const rb = roundTo(b, place);
  const calc = (x: number, y: number) => (op === 'add' ? x + y : op === 'sub' ? x - y : x * y);
  const sign = op === 'add' ? PLUS : op === 'sub' ? MINUS : TIMES;
  const floorA = Math.floor(a / place) * place;
  const floorB = Math.floor(b / place) * place;
  const estimate = calc(ra, rb);
  return integerTask({
    instruction: `Überschlage: Runde beide Zahlen auf ${PLACE_NAMES[place]}.`,
    prompt: `${expr(a, sign, b)} ≈ ?`,
    answer: estimate,
    // genau gerechnet statt überschlagen, beide abgerundet, falsch gerundet
    distractors: [calc(a, b), calc(floorA, floorB), calc(floorA + place, floorB + place), estimate + place, estimate - place],
    explanation: [`${expr(a)} ≈ ${expr(ra)}`, `${expr(b)} ≈ ${expr(rb)}`, expr(ra, sign, rb, '=', estimate)],
    max: MAX_MILLION,
  });
}

export const k4Rounding = generator('k4-rounding', (context) => {
  const { difficulty, rng } = context;
  return byDifficulty(difficulty, {
    easy: () => roundingTask(rng, 10, 3, 'any'),
    medium: () => {
      const place = rng.pick([100, 1000]);
      const mode = rng.pick(['any', 'any', 'five', 'chain'] as const);
      return roundingTask(rng, place, rng.int(4, 5), mode);
    },
    hard: () => estimationTask(rng, pickOperation(context, ['add', 'sub', 'mul']) as 'add' | 'sub' | 'mul'),
  });
});

// ---- Größen mit Komma ----------------------------------------------------------------

export const k4UnitsDecimal = generator('k4-units-decimal', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    easy: () => commaToSmall(rng.pick([UNITS.euroCt, UNITS.mCm]), rng, 9),
    medium: () => commaToSmall(rng.pick([UNITS.kgG, UNITS.kmM]), rng, 9),
    hard: () => smallToComma(rng.pick(DECIMAL_UNITS), rng, 9),
  }),
);

export const GRADE_4_GENERATORS: readonly TaskGenerator[] = [
  k4WrittenAddSub,
  k4WrittenMul,
  k4WrittenDiv,
  k4Rounding,
  k4UnitsDecimal,
];
