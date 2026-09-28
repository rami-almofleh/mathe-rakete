import { Difficulty, Operation, plain, tex } from '../../models';
import { bin, evaluate, evaluateIgnoringParens, evaluateLeftToRight, evaluationSteps, Expr, formatExpr, intermediates, operationsIn } from '../../math/expression';
import { formatInteger } from '../../math/format';
import { gcd, isPrime } from '../../math/number-theory';
import { Rational } from '../../math/rational';
import { Rng } from '../../math/rng';
import { numberAnswer, textAnswer } from '../answers';
import { Answer, GeneratedTask, TaskGenerator } from '../generator';
import { expr, integerTask, MINUS, PLUS, TIMES } from '../primary/helpers';
import { allowedOperations, byDifficulty, generator, lines, quantityFormat, sample, valueTask } from '../task-helpers';
import { digitsOf, isPrimeLike, primeFactorText, superscript } from './helpers';

// ---- Punkt vor Strich & Klammern ---------------------------------------------------

type Draw = { small: () => number; big: () => number };

interface Template {
  readonly levels: readonly Difficulty[];
  readonly build: (d: Draw) => Expr;
}

const ALL_LEVELS: readonly Difficulty[] = ['easy', 'medium', 'hard'];

const TEMPLATES: readonly Template[] = [
  // gemischt – hier steckt „Punkt vor Strich“
  { levels: ['easy'], build: ({ small, big }) => bin('add', big(), bin('mul', small(), small())) },
  { levels: ['easy'], build: ({ small, big }) => bin('add', bin('mul', small(), small()), big()) },
  { levels: ['easy'], build: ({ small, big }) => bin('sub', big(), bin('mul', small(), small())) },
  { levels: ['easy'], build: ({ small, big }) => bin('sub', bin('mul', small(), small()), big()) },
  { levels: ['easy'], build: ({ small, big }) => bin('add', big(), bin('div', big(), small())) },
  { levels: ['easy'], build: ({ small, big }) => bin('sub', big(), bin('div', big(), small())) },
  { levels: ['medium'], build: ({ small }) => bin('add', bin('mul', small(), small()), bin('mul', small(), small())) },
  { levels: ['medium'], build: ({ small }) => bin('sub', bin('mul', small(), small()), bin('mul', small(), small())) },
  { levels: ['medium'], build: ({ small, big }) => bin('sub', bin('add', big(), bin('mul', small(), small())), big()) },
  { levels: ['medium'], build: ({ small, big }) => bin('mul', bin('add', big(), small()), small()) },
  { levels: ['medium'], build: ({ small, big }) => bin('mul', small(), bin('sub', big(), small())) },
  { levels: ['medium'], build: ({ small, big }) => bin('add', bin('div', big(), small()), bin('mul', small(), small())) },
  { levels: ['medium'], build: ({ small, big }) => bin('div', bin('sub', big(), small()), small()) },
  { levels: ['hard'], build: ({ small, big }) => bin('sub', bin('mul', small(), bin('add', small(), small())), big()) },
  { levels: ['hard'], build: ({ small }) => bin('mul', bin('sub', small() + 10, small()), bin('add', small(), small())) },
  { levels: ['hard'], build: ({ small, big }) => bin('add', bin('div', bin('add', big(), big()), small()), big()) },
  { levels: ['hard'], build: ({ small, big }) => bin('sub', big() + 50, bin('div', bin('add', big(), small()), small())) },
  { levels: ['hard'], build: ({ small, big }) => bin('div', bin('sub', bin('mul', small(), small()), big()), small()) },
  // nur eine Rechenart oder Strich-/Punkt-Paare – falls das Kind nur einzelne Rechenarten wählt
  { levels: ALL_LEVELS, build: ({ big }) => bin('add', bin('add', big(), big()), big()) },
  { levels: ALL_LEVELS, build: ({ big }) => bin('sub', bin('sub', big() + 60, big()), big()) },
  { levels: ['medium', 'hard'], build: ({ big }) => bin('sub', big() + 60, bin('sub', big(), big())) },
  { levels: ALL_LEVELS, build: ({ small }) => bin('mul', bin('mul', small(), small()), small()) },
  { levels: ALL_LEVELS, build: ({ big, small }) => bin('div', bin('div', big() * 10, small()), small()) },
  { levels: ALL_LEVELS, build: ({ big }) => bin('add', bin('sub', big() + 30, big()), big()) },
  { levels: ['medium', 'hard'], build: ({ big }) => bin('sub', big() + 60, bin('add', big(), big())) },
  { levels: ALL_LEVELS, build: ({ small }) => bin('div', bin('mul', small(), small()), small()) },
  { levels: ['hard'], build: ({ small }) => bin('div', small() * small() * small(), bin('mul', small(), small())) },
];

/** Hinweis nur, wenn er zur Aufgabe passt. */
function orderHint(e: Expr): string[] {
  const ops = operationsIn(e);
  const hasParens = formatExpr(e).includes('(');
  const mixed = (ops.has('add') || ops.has('sub')) && (ops.has('mul') || ops.has('div'));
  if (hasParens && mixed) return ['Klammern zuerst, dann Punkt vor Strich.'];
  if (hasParens) return ['Klammern zuerst.'];
  if (mixed) return ['Punkt vor Strich: · und : zuerst.'];
  return ['Von links nach rechts rechnen.'];
}

export const k5OrderOfOps = generator('k5-order-of-ops', (context) => {
  const { difficulty, rng } = context;
  const allowed = allowedOperations(context, ['add', 'sub', 'mul', 'div']);
  const ranges = byDifficulty(difficulty, {
    easy: () => ({ small: [2, 9], big: [2, 40] }),
    medium: () => ({ small: [2, 12], big: [5, 80] }),
    hard: () => ({ small: [2, 12], big: [5, 120] }),
  });
  const candidates = TEMPLATES.filter((t) => t.levels.includes(difficulty)).filter((t) => {
    const probe = t.build({ small: () => 2, big: () => 2 });
    return [...operationsIn(probe)].every((op) => allowed.includes(op));
  });
  // gemischte Vorlagen bevorzugen, wenn mehrere Rechenarten erlaubt sind
  const mixed = candidates.filter((t) => operationsIn(t.build({ small: () => 2, big: () => 2 })).size > 1);
  const pool = mixed.length ? mixed : candidates;

  const e = sample(
    rng,
    (r) => {
      const template = r.pick(pool);
      return template.build({
        small: () => r.int(ranges.small[0], ranges.small[1]),
        big: () => r.int(ranges.big[0], ranges.big[1]),
      });
    },
    (e) => {
      try {
        return intermediates(e).every((v) => v.isInteger() && v.sign >= 0) && evaluate(e).compare(1000) <= 0;
      } catch {
        return false; // Division durch 0
      }
    },
  );
  const answer = evaluate(e);
  const wrong: number[] = [];
  for (const mistake of [evaluateLeftToRight, evaluateIgnoringParens]) {
    try {
      const v = mistake(e);
      if (v.isInteger()) wrong.push(v.num);
    } catch {
      // z. B. Division durch 0 im Fehlerweg
    }
  }
  const steps = evaluationSteps(e);
  return integerTask({
    prompt: `${formatExpr(e)} = ?`,
    answer: answer.num,
    // stur von links nach rechts, Klammer übersehen, verrechnet
    distractors: [...wrong, answer.num + 1, answer.num - 1, answer.num + 10, answer.num - 10],
    explanation: [
      ...orderHint(e),
      steps[0] + ' ' + steps[1],
      ...steps.slice(2),
    ],
  });
});

// ---- Rechengesetze -------------------------------------------------------------------

const PARTNERS_SUM: readonly [number, number][] = [
  [38, 62], [45, 55], [27, 73], [64, 36], [19, 81], [125, 75], [250, 750], [137, 63], [48, 52], [91, 9],
];
const PARTNERS_PRODUCT: readonly [number, number][] = [[25, 4], [5, 2], [20, 5], [125, 8], [50, 2], [4, 25], [2, 50], [8, 125]];

const LAWS = ['Kommutativgesetz', 'Assoziativgesetz', 'Distributivgesetz'] as const;

function lawTask(rng: Rng, allowed: readonly Operation[]): GeneratedTask {
  const law = rng.pick(allowed.includes('mul') ? LAWS : LAWS.slice(0, 2));
  const op = rng.pick(allowed.filter((o) => o === 'add' || o === 'mul'));
  const sym = op === 'add' ? PLUS : TIMES;
  const [a, b] = sample(rng, (r) => [r.int(2, 19), r.int(2, 19)], ([a, b]) => a !== b);
  const c = rng.int(2, 9);
  const identity =
    law === 'Kommutativgesetz'
      ? `${expr(a, sym, b)} = ${expr(b, sym, a)}`
      : law === 'Assoziativgesetz'
        ? `(${expr(a, sym, b)}) ${sym} ${c} = ${a} ${sym} (${expr(b, sym, c)})`
        : `${c} ${TIMES} (${expr(a, PLUS, b)}) = ${expr(c, TIMES, a, PLUS, c, TIMES, b)}`;
  const toAnswer = (name: string): Answer => textAnswer(plain(name), name);
  const hints: Record<(typeof LAWS)[number], string> = {
    Kommutativgesetz: 'Vertauschen: Die Reihenfolge der Zahlen ändert sich.',
    Assoziativgesetz: 'Verbinden: Nur die Klammern wandern.',
    Distributivgesetz: 'Verteilen: Der Faktor wird mit jedem Summanden malgenommen.',
  };
  return {
    prompt: { instruction: 'Welches Rechengesetz wurde benutzt?', math: plain(identity) },
    answer: toAnswer(law),
    distractors: LAWS.filter((l) => l !== law).map(toAnswer),
    explanation: lines(hints[law]),
  };
}

export const k5Laws = generator('k5-laws', (context) => {
  const { difficulty, rng } = context;
  const allowed = allowedOperations(context, ['add', 'mul']);
  const op = rng.pick(allowed);

  return byDifficulty(difficulty, {
    // 38 + 57 + 62 → erst 38 + 62
    easy: () => {
      if (op === 'mul') {
        const [p, q] = rng.pick(PARTNERS_PRODUCT);
        const m = rng.int(3, 19);
        const product = p * q * m;
        return integerTask({
          instruction: 'Rechne geschickt.',
          prompt: `${expr(p, TIMES, m, TIMES, q)} = ?`,
          answer: product,
          distractors: [product + p * q, product - p * q, product * 10, product / 10],
          explanation: [expr(p, TIMES, q, '=', p * q), expr(p * q, TIMES, m, '=', product)],
        });
      }
      const [p, q] = rng.pick(PARTNERS_SUM);
      const m = rng.int(11, 89);
      const sum = p + q + m;
      return integerTask({
        instruction: 'Rechne geschickt.',
        prompt: `${expr(p, PLUS, m, PLUS, q)} = ?`,
        answer: sum,
        distractors: [sum + 10, sum - 10, sum + 1, sum - 1, sum + 100],
        explanation: [`Vertauschen: ${expr(p, PLUS, q, PLUS, m)}`, expr(p, PLUS, q, '=', p + q), expr(p + q, PLUS, m, '=', sum)],
      });
    },
    // 7 · 98 = 7 · 100 − 7 · 2  bzw.  298 + 147 = 300 + 147 − 2
    medium: () => {
      if (op === 'add') {
        const offset = rng.int(1, 4);
        const round = rng.int(2, 9) * 100;
        const [a, b] = [round - offset, rng.int(101, 899)];
        const sum = a + b;
        return integerTask({
          instruction: 'Rechne geschickt.',
          prompt: `${expr(a, PLUS, b)} = ?`,
          answer: sum,
          // Ausgleich vergessen bzw. in die falsche Richtung ausgeglichen
          distractors: [round + b, round + b + offset, sum + 10, sum - 10],
          explanation: [`${expr(a, PLUS, b)} = ${expr(round, PLUS, b, MINUS, offset)}`, `= ${expr(round + b, MINUS, offset, '=', sum)}`],
        });
      }
      const factor = rng.int(3, 19);
      const offset = rng.int(1, 3) * rng.sign();
      const round = rng.pick([10, 20, 50, 100]);
      const other = round + offset;
      const product = factor * other;
      const sign = offset < 0 ? '−' : PLUS;
      return integerTask({
        instruction: 'Rechne geschickt.',
        prompt: `${expr(factor, TIMES, other)} = ?`,
        answer: product,
        // nur die runde Zahl verteilt (7 · 100 − 2), Vorzeichen vertauscht
        distractors: [factor * round + offset, factor * round - factor * offset, product + 10, product - 10],
        explanation: [
          `${expr(factor, TIMES, other)} = ${expr(factor, TIMES, round)} ${sign} ${expr(factor, TIMES, Math.abs(offset))}`,
          `= ${expr(factor * round)} ${sign} ${expr(factor * Math.abs(offset))} = ${expr(product)}`,
        ],
      });
    },
    // 13 · 7 + 13 · 3 = 13 · 10  – oder: Welches Gesetz?
    hard: () => {
      if (rng.chance(0.5) || !allowed.includes('mul')) return lawTask(rng, allowed);
      const factor = rng.int(11, 49);
      const a = rng.int(2, 9);
      const b = sample(rng, (r) => r.int(1, 9), (b) => (a + b) % 5 === 0);
      const total = factor * (a + b);
      return integerTask({
        instruction: 'Rechne geschickt.',
        prompt: `${expr(factor, TIMES, a, PLUS, factor, TIMES, b)} = ?`,
        answer: total,
        // Punkt vor Strich missachtet, nur einmal verteilt
        distractors: [factor * a + b, (factor * a + factor) * b, total + factor, total - factor],
        explanation: [
          `Ausklammern: ${expr(factor, TIMES)} (${expr(a, PLUS, b)})`,
          `= ${expr(factor, TIMES, a + b, '=', total)}`,
        ],
      });
    },
  });
});

// ---- Potenzen ----------------------------------------------------------------------------

const BOX_SQUARE = `□${superscript(2)}`;

function power(base: number, exponent: number): string {
  return `${formatInteger(base)}${superscript(exponent)}`;
}

export const k5Powers = generator('k5-powers', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    // Quadratzahlen
    easy: () => {
      const n = rng.int(2, 12);
      return integerTask({
        prompt: `${power(n, 2)} = ?`,
        answer: n * n,
        // mal 2 statt hoch 2, Nachbar-Quadratzahlen
        distractors: [2 * n, (n + 1) ** 2, (n - 1) ** 2, n + 2],
        explanation: [`${power(n, 2)} = ${expr(n, TIMES, n, '=', n * n)}`],
      });
    },
    medium: () => {
      const [base, exponent] = rng.chance(0.25)
        ? [10, rng.int(2, 6)]
        : sample(rng, (r) => [r.int(2, 5), r.int(3, 6)], ([b, e]) => b ** e <= 1024);
      const value = base ** exponent;
      return integerTask({
        prompt: `${power(base, exponent)} = ?`,
        answer: value,
        // Basis mal Exponent, Basis und Exponent vertauscht, eine Stufe daneben
        distractors: [base * exponent, exponent ** base, base ** (exponent - 1), base ** (exponent + 1)],
        explanation: [
          `${power(base, exponent)} = ${Array.from({ length: exponent }, () => formatInteger(base)).join(` ${TIMES} `)} = ${formatInteger(value)}`,
        ],
      });
    },
    hard: () => {
      if (rng.chance(0.4)) {
        const n = rng.int(11, 20);
        return integerTask({
          prompt: `${BOX_SQUARE} = ${formatInteger(n * n)}`,
          instruction: 'Welche Zahl passt in das Kästchen?',
          answer: n,
          distractors: [(n * n) / 2, n + 1, n - 1, n + 2],
          explanation: [`${power(n, 2)} = ${expr(n, TIMES, n, '=', n * n)}`],
        });
      }
      const [a, m, b, n] = [rng.int(2, 5), rng.int(2, 4), rng.int(2, 6), 2];
      const useProduct = rng.chance(0.4);
      const value = useProduct ? a ** m * b : a ** m + b ** n;
      const prompt = useProduct ? `${power(a, m)} ${TIMES} ${b} = ?` : `${power(a, m)} + ${power(b, n)} = ?`;
      const wrongLinear = useProduct ? a * m * b : a * m + b * n;
      const wrongBase = useProduct ? (a * b) ** m : (a + b) ** n;
      return integerTask({
        prompt,
        answer: value,
        distractors: [wrongLinear, wrongBase, value + 1, value - 1],
        explanation: useProduct
          ? [`${power(a, m)} = ${formatInteger(a ** m)}`, expr(a ** m, TIMES, b, '=', value)]
          : [`${power(a, m)} = ${formatInteger(a ** m)}`, `${power(b, n)} = ${formatInteger(b ** n)}`, expr(a ** m, PLUS, b ** n, '=', value)],
      });
    },
  }),
);


// ---- Teilbarkeit & Primzahlen -----------------------------------------------------------

type Property = { label: string; test: (n: number) => boolean; explain: (n: number) => string; tricky: (rng: Rng, digits: number) => number };

const digitSum = (n: number) => digitsOf(n).reduce((a, b) => a + b, 0);

const PROPERTIES: Record<string, Property> = {
  2: { label: 'durch 2 teilbar', test: (n) => n % 2 === 0, explain: (n) => `${formatInteger(n)}: Endziffer ${n % 10} ${n % 2 === 0 ? 'ist gerade' : 'ist ungerade'}`, tricky: (r, d) => withDigitsOdd(r, d) },
  5: { label: 'durch 5 teilbar', test: (n) => n % 5 === 0, explain: (n) => `${formatInteger(n)}: Endziffer ${n % 10}`, tricky: (r, d) => sample(r, (x) => x.int(10 ** (d - 1), 10 ** d - 1), (n) => n % 5 !== 0) },
  10: { label: 'durch 10 teilbar', test: (n) => n % 10 === 0, explain: (n) => `${formatInteger(n)}: Endziffer ${n % 10}`, tricky: (r, d) => r.int(10 ** (d - 2), 10 ** (d - 1) - 1) * 10 + r.pick([5, 2, 8]) },
  3: { label: 'durch 3 teilbar', test: (n) => n % 3 === 0, explain: (n) => `${formatInteger(n)}: Quersumme ${digitSum(n)}`, tricky: (r, d) => sample(r, (x) => x.int(10 ** (d - 1), 10 ** d - 1), (n) => n % 3 !== 0) },
  9: { label: 'durch 9 teilbar', test: (n) => n % 9 === 0, explain: (n) => `${formatInteger(n)}: Quersumme ${digitSum(n)}`, tricky: (r, d) => sample(r, (x) => x.int(10 ** (d - 1), 10 ** d - 1), (n) => n % 3 === 0 && n % 9 !== 0) },
  4: { label: 'durch 4 teilbar', test: (n) => n % 4 === 0, explain: (n) => `${formatInteger(n)}: die letzten zwei Ziffern ${String(n % 100).padStart(2, '0')}`, tricky: (r, d) => sample(r, (x) => x.int(10 ** (d - 1), 10 ** d - 1), (n) => n % 2 === 0 && n % 4 !== 0) },
  6: { label: 'durch 6 teilbar', test: (n) => n % 6 === 0, explain: (n) => `${formatInteger(n)}: ${n % 2 === 0 ? 'gerade' : 'ungerade'}, Quersumme ${digitSum(n)}`, tricky: (r, d) => sample(r, (x) => x.int(10 ** (d - 1), 10 ** d - 1), (n) => (n % 3 === 0) !== (n % 2 === 0)) },
  prime: { label: 'eine Primzahl', test: isPrime, explain: (n) => (isPrime(n) ? `${n} hat nur die Teiler 1 und ${n}` : `${n} = ${primeFactorText(n)}`), tricky: (r) => sample(r, (x) => x.int(21, 99), (n) => !isPrime(n) && isPrimeLike(n)) },
};

function withDigitsOdd(rng: Rng, digits: number): number {
  return rng.int(10 ** (digits - 1), 10 ** digits - 1) | 1;
}

const RULES: Record<string, string> = {
  2: 'Eine Zahl ist durch 2 teilbar, wenn ihre Endziffer gerade ist.',
  5: 'Eine Zahl ist durch 5 teilbar, wenn sie auf 0 oder 5 endet.',
  10: 'Eine Zahl ist durch 10 teilbar, wenn sie auf 0 endet.',
  3: 'Eine Zahl ist durch 3 teilbar, wenn ihre Quersumme durch 3 teilbar ist.',
  9: 'Eine Zahl ist durch 9 teilbar, wenn ihre Quersumme durch 9 teilbar ist.',
  4: 'Eine Zahl ist durch 4 teilbar, wenn ihre letzten zwei Ziffern eine durch 4 teilbare Zahl bilden.',
  6: 'Eine Zahl ist durch 6 teilbar, wenn sie durch 2 und durch 3 teilbar ist.',
  prime: 'Eine Primzahl hat genau zwei Teiler: 1 und sich selbst.',
};

export const k5Divisibility = generator('k5-divisibility', ({ difficulty, rng }) => {
  const key = byDifficulty(difficulty, {
    easy: () => rng.pick(['2', '5', '10']),
    medium: () => rng.pick(['3', '4', '9']),
    hard: () => rng.pick(['6', 'prime', 'prime']),
  });
  const property = PROPERTIES[key];
  const digits = difficulty === 'easy' ? rng.int(2, 3) : rng.int(3, 4);
  const answer =
    key === 'prime'
      ? sample(rng, (r) => r.int(11, 97), isPrime)
      : sample(rng, (r) => r.int(10 ** (digits - 1), 10 ** digits - 1), property.test);
  // genau zwei feste Ablenker – der Lösungsweg erklärt alle drei angezeigten Zahlen
  const wrong = new Set<number>();
  for (let i = 0; wrong.size < 2 && i < 200; i++) {
    const n = property.tricky(rng, digits);
    if (!property.test(n) && n !== answer) wrong.add(n);
  }
  if (wrong.size < 2) throw new Error('Keine passenden Ablenker');
  const shown = [answer, ...wrong].sort((a, b) => a - b);
  return {
    prompt: { instruction: 'Welche Zahl ist …', math: plain(`${property.label}?`) },
    answer: numberAnswer(answer),
    distractors: [...wrong].map((n) => numberAnswer(n)),
    explanation: lines(RULES[key], ...shown.map(property.explain)),
  };
});

// ---- Rechteck: Umfang & Flächeninhalt ---------------------------------------------------

const LENGTH_UNITS = ['cm', 'm', 'mm'] as const;

export const k5Rectangle = generator('k5-rectangle', ({ difficulty, rng }) => {
  const unit = rng.pick(LENGTH_UNITS);
  const maxSide = difficulty === 'easy' ? 12 : 25;
  const square = difficulty !== 'easy' && rng.chance(0.3);
  const a = rng.int(2, maxSide);
  const b = square ? a : sample(rng, (r) => r.int(2, maxSide), (b) => b !== a);
  const area = a * b;
  const perimeter = 2 * (a + b);
  const shape = square ? `Quadrat: a = ${a} ${unit}` : `Rechteck: a = ${a} ${unit}, b = ${b} ${unit}`;
  const len = quantityFormat(unit);
  const sq = quantityFormat(`${unit}²`);

  if (difficulty === 'hard') {
    // Umkehraufgabe: Seite aus Fläche oder Umfang
    if (rng.chance(0.5)) {
      return valueTask({
        instruction: 'Wie lang ist die Seite b?',
        prompt: plain(`Rechteck: A = ${area} ${unit}², a = ${a} ${unit}`),
        answer: b,
        distractors: [area - a, area / 2, b + 1, b - 1],
        format: len,
        explanation: lines(`A = a ${TIMES} b`, `b = A : a = ${area} : ${a} = ${b} ${unit}`),
      });
    }
    return valueTask({
      instruction: 'Wie lang ist die Seite b?',
      prompt: plain(`Rechteck: U = ${perimeter} ${unit}, a = ${a} ${unit}`),
      answer: b,
      // nicht halbiert, nur einmal a abgezogen
      distractors: [perimeter - 2 * a, perimeter - a, b + 1, b - 1],
      format: len,
      explanation: lines(`U = 2 ${TIMES} (a + b)`, `a + b = ${perimeter} : 2 = ${perimeter / 2}`, `b = ${perimeter / 2} − ${a} = ${b} ${unit}`),
    });
  }

  if (rng.chance(0.5)) {
    const task = valueTask({
      instruction: 'Berechne den Flächeninhalt.',
      prompt: plain(shape),
      answer: area,
      distractors: [perimeter, a + b],
      format: sq,
      explanation: lines(`A = a ${TIMES} b = ${a} ${unit} ${TIMES} ${b} ${unit} = ${area} ${unit}²`),
    });
    // gleiche Zahl, aber falsche Einheit ist auch falsch
    return { ...task, distractors: [...task.distractors, len(Rational.of(area))] };
  }
  const task = valueTask({
    instruction: 'Berechne den Umfang.',
    prompt: plain(shape),
    answer: perimeter,
    distractors: [area, a + b, perimeter + 2],
    format: len,
    explanation: lines(`U = 2 ${TIMES} (a + b) = 2 ${TIMES} (${a} + ${b}) ${unit} = ${perimeter} ${unit}`),
  });
  return { ...task, distractors: [...task.distractors, sq(Rational.of(perimeter))] };
});

// ---- Anteile: ¾ von 20 --------------------------------------------------------------------

const PART_OF_UNITS: readonly { whole: string; label: string; small: string; factor: number }[] = [
  { whole: '1\\,\\text{h}', label: '1 h', small: 'min', factor: 60 },
  { whole: '1\\,\\text{kg}', label: '1 kg', small: 'g', factor: 1000 },
  { whole: '1\\,\\text{km}', label: '1 km', small: 'm', factor: 1000 },
  { whole: '1\\,\\text{m}', label: '1 m', small: 'cm', factor: 100 },
  // „€“ gibt es in den KaTeX-Schriften nicht – deshalb ausgeschrieben
  { whole: '1\\,\\text{Euro}', label: '1 €', small: 'ct', factor: 100 },
];

export const k5FractionOf = generator('k5-fraction-of', ({ difficulty, rng }) => {
  if (difficulty === 'hard') {
    const u = rng.pick(PART_OF_UNITS);
    const den = sample(rng, (r) => r.int(3, 10), (d) => u.factor % d === 0);
    const numerator = sample(rng, (x) => x.int(1, den - 1), (n) => gcd(n, den) === 1);
    const unitPart = u.factor / den;
    const part = unitPart * numerator;
    return valueTask({
      prompt: tex(`\\tfrac{${numerator}}{${den}} \\text{ von } ${u.whole} = \\;?`),
      answer: part,
      // nur geteilt, nur malgenommen, ein Teil zu viel
      distractors: [unitPart, u.factor * numerator, part + unitPart, part - unitPart],
      format: quantityFormat(u.small),
      explanation: lines(
        `${u.label} = ${formatInteger(u.factor)} ${u.small}`,
        `${formatInteger(u.factor)} : ${den} = ${formatInteger(unitPart)}`,
        ...(numerator > 1 ? [`${formatInteger(unitPart)} ${TIMES} ${numerator} = ${formatInteger(part)} ${u.small}`] : []),
      ),
    });
  }
  const den = difficulty === 'easy' ? rng.int(2, 10) : rng.int(3, 10);
  const numerator = difficulty === 'easy' ? 1 : sample(rng, (x) => x.int(2, den - 1), (n) => gcd(n, den) === 1);
  const whole = den * rng.int(2, difficulty === 'easy' ? 10 : 20);
  const part = (whole / den) * numerator;
  return valueTask({
    prompt: tex(`\\tfrac{${numerator}}{${den}} \\text{ von } ${formatInteger(whole, 'tex')} = \\;?`),
    answer: part,
    // nur geteilt, nur malgenommen, durch den Zähler geteilt, ein Teil zu viel
    distractors: [whole / den, whole * numerator, whole / numerator, part + whole / den, whole],
    explanation: lines(
      `${formatInteger(whole)} : ${den} = ${formatInteger(whole / den)}`,
      ...(numerator > 1 ? [`${formatInteger(whole / den)} ${TIMES} ${numerator} = ${formatInteger(part)}`] : []),
    ),
  });
});

export const GRADE_5_GENERATORS: readonly TaskGenerator[] = [
  k5OrderOfOps,
  k5Laws,
  k5Powers,
  k5Divisibility,
  k5Rectangle,
  k5FractionOf,
];

