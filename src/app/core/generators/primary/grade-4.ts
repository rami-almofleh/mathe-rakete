import { plain } from '../../models';
import { Rational } from '../../math/rational';
import { Rng } from '../../math/rng';
import { quantityFormat } from '../task-helpers';
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
import { compareTask, placeValueByDifficulty } from './number-sense';
import { timeSpanTask } from './time';
import { cinema, discount, roundTrips, sacks, saving, seatsLeft, visitors, wordProblemTask } from './word-problems';
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

/** „4 387 ≈ ?“ – auch von Kl. 3 genutzt (dreistellig, `max` = 1 000). */
export function roundingTask(rng: Rng, place: number, digits: number, mode: 'any' | 'five' | 'chain', max = MAX_MILLION): GeneratedTask {
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
  // auf 0 gerundet ist kein glaubwürdiger Fehler (353 → 0)
  const distractors = [rounded === up ? down : up, roundTo(n, place * 10), rounded + place].filter((d) => d > 0);
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
    max,
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

// ---- Große Zahlen -------------------------------------------------------------------------------

/** Stellentafel bis 1 Million – nur drei Stellen sind besetzt, die Nullen muss das Kind selbst setzen (3 HT + 5 T + 2 Z = 305 020). */
export const k4PlaceValue = generator('k4-place-value', ({ difficulty, rng }) =>
  placeValueByDifficulty(rng, difficulty, { places: ['HT', 'ZT', 'T', 'H', 'Z', 'E'], sparse: 3, max: MAX_MILLION }),
);

export const k4Compare = generator('k4-compare', ({ difficulty, rng }) => compareTask(rng, difficulty, { min: 1000, max: MAX_MILLION, step: 1000 }));

/** Zeitspannen über mehrere Stunden, zuletzt minutengenau (7:48 Uhr → 11:13 Uhr) */
export const k4TimeSpan = generator('k4-time-span', ({ difficulty, rng }) => {
  const [start, duration] = byDifficulty<[number, number]>(difficulty, {
    easy: () => [rng.int(7, 14) * 60 + 15 * rng.int(0, 3), 60 * rng.int(1, 4) + 15 * rng.int(1, 3)],
    medium: () => [rng.int(7, 13) * 60 + 5 * rng.int(1, 11), 60 * rng.int(2, 5) + 5 * rng.int(1, 11)],
    hard: () => [rng.int(6, 12) * 60 + rng.int(1, 59), 60 * rng.int(1, 6) + rng.int(1, 59)],
  });
  return timeSpanTask(start, duration);
});

export const k4WordProblems = generator('k4-word-problems', ({ difficulty, rng }) =>
  wordProblemTask(
    rng,
    byDifficulty(difficulty, {
      easy: () => [discount, visitors(1000, 20_000)],
      medium: () => [cinema, sacks, saving],
      hard: () => [seatsLeft, roundTrips, cinema],
    }),
    MAX_MILLION,
  ),
);

// ---- Maßstab ----------------------------------------------------------------------------------

/** Wirklichkeit in m bzw. km (bei 1 : 100 000) */
function realUnit(scale: number): { unit: 'm' | 'km'; cm: number } {
  return scale >= 100_000 ? { unit: 'km', cm: 100_000 } : { unit: 'm', cm: 100 };
}

export const k4Scale = generator('k4-scale', ({ difficulty, rng }) => {
  const scale = byDifficulty(difficulty, {
    easy: () => 100,
    medium: () => rng.pick([1000, 10_000]),
    hard: () => rng.pick([10_000, 100_000]),
  });
  const { unit, cm } = realUnit(scale);
  const map = rng.int(2, 9);
  const real = (map * scale) / cm;
  const instruction = `Maßstab 1 : ${expr(scale)}`;
  if (difficulty === 'hard' && rng.chance(0.5)) {
    // Rückwärts: Wirklichkeit → Karte
    return integerTask({
      instruction,
      prompt: `In Wirklichkeit: ${expr(real)} ${unit}. Auf der Karte: ?`,
      answer: map,
      format: (n) => quantityFormat('cm')(Rational.of(n)),
      // Stelle verrutscht, Zahl übernommen
      distractors: [map * 10, real, map + 1, map * 100],
      explanation: [`1 cm auf der Karte sind ${expr(scale)} cm = ${expr(scale / cm)} ${unit} in Wirklichkeit.`, `${expr(real)} ${unit} ${DIVIDED} ${expr(scale / cm)} ${unit} = ${map} → ${map} cm`],
    });
  }
  return integerTask({
    instruction,
    prompt: `Auf der Karte: ${map} cm. In Wirklichkeit: ?`,
    answer: real,
    format: (n) => quantityFormat(unit)(Rational.of(n)),
    // eine Null zu viel/wenig, Maßstab vergessen
    distractors: [real * 10, real / 10, map, real * 100],
    explanation: [`1 cm auf der Karte sind ${expr(scale)} cm in Wirklichkeit.`, `${map} cm ${TIMES} ${expr(scale)} = ${expr(map * scale)} cm = ${expr(real)} ${unit}`],
  });
});

// ---- Rechteck: Fläche und Umfang ------------------------------------------------------------------

export const k4Rectangle = generator('k4-rectangle', ({ difficulty, rng }) => {
  const unit = rng.pick(['cm', 'm']);
  const len = quantityFormat(unit);
  const sq = quantityFormat(`${unit}²`);
  const [a, b] = sample(rng, (r) => [r.int(3, difficulty === 'easy' ? 9 : 15), r.int(2, difficulty === 'easy' ? 8 : 12)], ([a, b]) => a > b);
  const area = a * b;
  const perimeter = 2 * (a + b);
  const asked = rng.pick(['area', 'perimeter'] as const);
  const task = (prompt: string, answer: Rational, wrong: Rational[], fmt: typeof len, otherFmt: typeof len, explanation: string[]): GeneratedTask => ({
    prompt: { math: plain(prompt) },
    answer: fmt(answer),
    // dieselbe Zahl mit falscher Einheit ist auch falsch (cm statt cm²)
    distractors: [...wrong.filter((w) => w.sign > 0 && !w.equals(answer)).map(fmt), otherFmt(answer)],
    explanation: explanation.map(plain),
  });
  return byDifficulty(difficulty, {
    easy: () =>
      asked === 'area'
        ? task(`Ein Rechteck ist ${a} ${unit} lang und ${b} ${unit} breit. Wie groß ist der Flächeninhalt?`, Rational.of(area), [Rational.of(perimeter), Rational.of(a + b)], sq, len, [`A = Länge ${TIMES} Breite = ${a} ${TIMES} ${b} = ${area} ${unit}²`])
        : task(`Ein Rechteck ist ${a} ${unit} lang und ${b} ${unit} breit. Wie lang ist der Umfang?`, Rational.of(perimeter), [Rational.of(area), Rational.of(a + b)], len, sq, [`U = ${a} + ${b} + ${a} + ${b} = ${perimeter} ${unit}`]),
    medium: () => {
      if (rng.chance(0.4)) {
        // Quadrat
        return asked === 'area'
          ? task(`Ein Quadrat hat ${a} ${unit} lange Seiten. Wie groß ist der Flächeninhalt?`, Rational.of(a * a), [Rational.of(4 * a), Rational.of(2 * a)], sq, len, [`A = ${a} ${TIMES} ${a} = ${a * a} ${unit}²`])
          : task(`Ein Quadrat hat ${a} ${unit} lange Seiten. Wie lang ist der Umfang?`, Rational.of(4 * a), [Rational.of(a * a), Rational.of(2 * a)], len, sq, [`U = 4 ${TIMES} ${a} = ${4 * a} ${unit}`]);
      }
      return asked === 'area'
        ? task(`Ein Rechteck ist ${a} ${unit} lang und ${b} ${unit} breit. Wie groß ist der Flächeninhalt?`, Rational.of(area), [Rational.of(perimeter), Rational.of(area + a)], sq, len, [`A = ${a} ${TIMES} ${b} = ${area} ${unit}²`])
        : task(`Ein Rechteck ist ${a} ${unit} lang und ${b} ${unit} breit. Wie lang ist der Umfang?`, Rational.of(perimeter), [Rational.of(area), Rational.of(a + b), Rational.of(2 * a + b)], len, sq, [`U = 2 ${TIMES} (${a} + ${b}) = ${perimeter} ${unit}`]);
    },
    // Umkehraufgabe: fehlende Seite
    hard: () =>
      asked === 'area'
        ? task(`Ein Rechteck ist ${a} ${unit} lang und hat einen Flächeninhalt von ${area} ${unit}². Wie breit ist es?`, Rational.of(b), [Rational.of(area - a), Rational.of(b + 1), Rational.of(b - 1)], len, sq, [`A = Länge ${TIMES} Breite`, `Breite = ${area} ${DIVIDED} ${a} = ${b} ${unit}`])
        : task(`Ein Rechteck ist ${a} ${unit} lang und hat einen Umfang von ${perimeter} ${unit}. Wie breit ist es?`, Rational.of(b), [Rational.of(perimeter - a), Rational.of(perimeter - 2 * a), Rational.of(b + 1)], len, sq, [`Länge + Breite = ${perimeter} ${DIVIDED} 2 = ${a + b} ${unit}`, `Breite = ${a + b} − ${a} = ${b} ${unit}`]),
  });
});

export const GRADE_4_GENERATORS: readonly TaskGenerator[] = [
  k4PlaceValue,
  k4Compare,
  k4WrittenAddSub,
  k4WrittenMul,
  k4WrittenDiv,
  k4Rounding,
  k4UnitsDecimal,
  k4TimeSpan,
  k4Scale,
  k4Rectangle,
  k4WordProblems,
];
