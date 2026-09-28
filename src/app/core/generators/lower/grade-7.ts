import { Operation, plain } from '../../models';
import { bin, evaluate, evaluateIgnoringParens, evaluateLeftToRight, evaluationSteps, Expr, formatExpr, intermediates } from '../../math/expression';
import { formatDecimal, formatInteger } from '../../math/format';
import { LinearTerm } from '../../math/linear-term';
import { Rational } from '../../math/rational';
import { Rng } from '../../math/rng';
import { numberFormat, textAnswer } from '../answers';
import { Answer, GeneratedTask, TaskGenerator } from '../generator';
import { MINUS, PLUS, TIMES } from '../primary/helpers';
import {
  byDifficulty,
  degreeFormat,
  generator,
  lines,
  moneyFormat,
  pickOperation,
  quantityFormat,
  sample,
  valueTask,
} from '../task-helpers';

const r = Rational.of;
const decimal = numberFormat('decimal', 'plain');
const signed = (rng: Rng, min: number, max: number) => rng.int(min, max) * rng.sign();

/** Fehlerweg nachrechnen – kann selbst durch 0 teilen, dann gibt es diesen Ablenker eben nicht. */
function safely(compute: () => Rational): Rational[] {
  try {
    return [compute()];
  } catch {
    return [];
  }
}

// ---- Rechnen mit negativen Zahlen -------------------------------------------------------

const SIGN_RULES: Record<Operation, string> = {
  add: 'Verschiedene Vorzeichen: Beträge subtrahieren, Vorzeichen der Zahl mit dem größeren Betrag.',
  sub: 'Minus einer negativen Zahl ist Plus: a − (−b) = a + b.',
  mul: 'Gleiche Vorzeichen ergeben Plus, verschiedene Vorzeichen ergeben Minus.',
  div: 'Gleiche Vorzeichen ergeben Plus, verschiedene Vorzeichen ergeben Minus.',
};

export const k7Integers = generator('k7-integers', (context) => {
  const { difficulty, rng } = context;
  const op = pickOperation(context, ['add', 'sub', 'mul', 'div']);
  const max = difficulty === 'easy' ? 12 : 25;

  if (difficulty === 'hard') {
    // (−3) · 4 − (−5): Vorzeichen und Punkt vor Strich zugleich
    const outer = pickOperation(context, ['add', 'sub', 'mul', 'div']);
    const e = sample(
      rng,
      (x) => {
        const inner: Expr =
          op === 'div' ? bin('div', signed(x, 2, 9) * x.int(2, 9), signed(x, 2, 9)) : bin(op, signed(x, 2, 12), signed(x, 2, 12));
        const third = signed(x, 2, 15);
        return x.chance(0.5) ? bin(outer, inner, third) : bin(outer, third, inner);
      },
      (e) => {
        try {
          return intermediates(e).every((v) => v.isInteger()) && evaluate(e).abs().compare(500) <= 0;
        } catch {
          return false; // Division durch 0
        }
      },
    );
    const answer = evaluate(e);
    const [first, ...rest] = evaluationSteps(e);
    return valueTask({
      prompt: plain(`${formatExpr(e)} = ?`),
      answer,
      // Vorzeichenfehler, von links nach rechts, Klammer übersehen
      distractors: [answer.neg(), ...safely(() => evaluateLeftToRight(e)), ...safely(() => evaluateIgnoringParens(e)), answer.add(2), answer.sub(2)],
      format: decimal,
      explanation: lines(SIGN_RULES[op], `${first} ${rest[0]}`, ...rest.slice(1)),
    });
  }

  const [a, b] = sample(
    rng,
    (x) => [signed(x, 1, max), signed(x, 1, max)],
    ([a, b]) => (difficulty === 'easy' ? a < 0 !== b < 0 : a < 0 || b < 0) && (op !== 'div' || Math.abs(b) > 1),
  );
  const [x, y] = op === 'div' ? [a * b, b] : [a, b];
  const e = bin(op, x, y);
  const answer = evaluate(e);
  const distractors: number[] =
    op === 'add'
      ? [-answer.num, Math.abs(x) + Math.abs(y), -(Math.abs(x) + Math.abs(y))]
      : op === 'sub'
        ? [x + y, -answer.num, -(x + y)] // Vorzeichen des Subtrahenden übersehen
        : op === 'mul'
          ? [-answer.num, x + y, Math.abs(answer.num) + 1] // Vorzeichen, plus statt mal
          : [-answer.num, answer.num + 1, answer.num - 1];
  return valueTask({
    prompt: plain(`${formatExpr(e)} = ?`),
    answer,
    distractors,
    format: decimal,
    explanation: lines(SIGN_RULES[op], `${formatExpr(e)} = ${formatDecimal(answer)}`),
  });
});

// ---- Prozent- und Zinsrechnung -----------------------------------------------------------

const NICE_PERCENTS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80];

function percentBase(rng: Rng, p: number, difficulty: string): number {
  // Grundwert so, dass der Prozentwert ganzzahlig ist
  const step = 100 / (p % 25 === 0 ? 25 : p % 10 === 0 ? 10 : 5);
  return step * rng.int(1, difficulty === 'easy' ? 10 : 40);
}

export const k7Percent = generator('k7-percent', ({ difficulty, rng }) => {
  const p = rng.pick(NICE_PERCENTS);
  const g = sample(rng, (x) => percentBase(x, p, difficulty), (g) => (g * p) % 100 === 0 && g > 1);
  const w = (g * p) / 100;
  const pct = quantityFormat('%');

  return byDifficulty<GeneratedTask>(difficulty, {
    // Prozentwert: 15 % von 80
    easy: () =>
      valueTask({
        prompt: plain(`${p} % von ${formatInteger(g)} = ?`),
        answer: w,
        // Komma verrutscht, abgezogen statt berechnet, Prozentsatz addiert
        distractors: [Rational.decimal(w, 1), w * 10, g - w, g + p],
        format: decimal,
        explanation: lines(`W = G ${TIMES} p %`, `W = ${formatInteger(g)} ${TIMES} ${formatDecimal(Rational.decimal(p, 2))} = ${formatInteger(w)}`),
      }),
    // Prozentsatz: 12 von 80 sind ? %
    medium: () =>
      valueTask({
        prompt: plain(`${formatInteger(w)} von ${formatInteger(g)} sind ? %`),
        answer: p,
        distractors: [w, r(p, 10), p * 10, 100 - p],
        format: pct,
        explanation: lines(`p % = W : G`, `p % = ${formatInteger(w)} : ${formatInteger(g)} = ${formatDecimal(Rational.decimal(p, 2))} = ${p} %`),
      }),
    // Grundwert: 12 sind 15 % von ?
    hard: () =>
      valueTask({
        prompt: plain(`${formatInteger(w)} sind ${p} % von ?`),
        answer: g,
        // Prozentwert von W berechnet, mal statt geteilt
        distractors: [r(w * p, 100), w * p, w + p, g * 10],
        format: decimal,
        explanation: lines(`G = W : p %`, `G = ${formatInteger(w)} : ${formatDecimal(Rational.decimal(p, 2))} = ${formatInteger(g)}`),
      }),
  });
});

export const k7Interest = generator('k7-interest', ({ difficulty, rng }) => {
  const k = rng.pick([200, 300, 400, 500, 600, 800, 1000, 1200, 1500, 2000, 2400, 3000]);
  const p = rng.int(1, 6);
  const yearly = r(k * p, 100);
  const money = moneyFormat();

  return byDifficulty<GeneratedTask>(difficulty, {
    easy: () =>
      valueTask({
        instruction: 'Wie viele Zinsen gibt es nach einem Jahr?',
        prompt: plain(`${formatInteger(k)} € zu ${p} %`),
        answer: yearly,
        // nicht durch 100 geteilt, Komma verrutscht, Endbetrag statt Zinsen
        distractors: [yearly.mul(100), yearly.mul(10), yearly.add(k), yearly.div(10)],
        format: money,
        explanation: lines(`Z = K ${TIMES} p %`, `Z = ${formatInteger(k)} € ${TIMES} ${formatDecimal(Rational.decimal(p, 2))} = ${formatDecimal(yearly)} €`),
      }),
    medium: () =>
      valueTask({
        instruction: 'Wie viel Geld ist nach einem Jahr auf dem Konto?',
        prompt: plain(`${formatInteger(k)} € zu ${p} %`),
        answer: yearly.add(k),
        distractors: [yearly, yearly.mul(10).add(k), r(k + p), yearly.add(k).add(yearly)],
        format: money,
        explanation: lines(`Zinsen: ${formatInteger(k)} € ${TIMES} ${formatDecimal(Rational.decimal(p, 2))} = ${formatDecimal(yearly)} €`, `${formatInteger(k)} € + ${formatDecimal(yearly)} € = ${formatDecimal(yearly.add(k))} €`),
      }),
    hard: () => {
      const months = sample(rng, (x) => x.pick([3, 4, 6, 8, 9]), (m) => (yearly.mul(r(m, 12)).decimalPlaces() ?? 9) <= 2);
      const interest = yearly.mul(r(months, 12));
      return valueTask({
        instruction: 'Wie viele Zinsen gibt es?',
        prompt: plain(`${formatInteger(k)} € zu ${p} % für ${months} Monate`),
        answer: interest,
        // für ein ganzes Jahr gerechnet, Monate wie Jahre
        distractors: [yearly, yearly.mul(months), yearly.div(months), interest.mul(10)],
        format: money,
        explanation: lines(
          `Jahreszinsen: ${formatInteger(k)} € ${TIMES} ${formatDecimal(Rational.decimal(p, 2))} = ${formatDecimal(yearly)} €`,
          `${months} Monate = ${months}/12 Jahr`,
          `Z = ${formatDecimal(yearly)} € ${TIMES} ${months} : 12 = ${money(interest).display.value}`,
        ),
      });
    },
  });
});

// ---- Dreisatz ------------------------------------------------------------------------------

const PROPORTIONAL = [
  { money: true, unit: '€', one: '1 kg', given: (n: number, v: string) => `${n} kg Äpfel kosten ${v}.`, ask: (n: number) => `Wie viel kosten ${n} kg?` },
  { money: true, unit: '€', one: '1 Heft', given: (n: number, v: string) => `${n} Hefte kosten ${v}.`, ask: (n: number) => `Wie viel kosten ${n} Hefte?` },
  { money: true, unit: '€', one: '1 l', given: (n: number, v: string) => `${n} l Saft kosten ${v}.`, ask: (n: number) => `Wie viel kosten ${n} l?` },
  { money: false, unit: 'km', one: '1 Stunde', given: (n: number, v: string) => `Ein Radfahrer fährt in ${n} Stunden ${v}.`, ask: (n: number) => `Wie weit fährt er in ${n} Stunden?` },
];

const ANTIPROPORTIONAL = [
  { who: 'Maler', one: '1 Maler', task: 'streichen ein Haus in', unit: 'Tage' },
  { who: 'Pumpen', one: '1 Pumpe', task: 'leeren ein Becken in', unit: 'Stunden' },
  { who: 'Bagger', one: '1 Bagger', task: 'heben eine Grube aus in', unit: 'Tage' },
];

export const k7RuleOfThree = generator('k7-rule-of-three', ({ difficulty, rng }) => {
  if (difficulty === 'hard') {
    const c = rng.pick(ANTIPROPORTIONAL);
    const total = rng.pick([12, 24, 36, 48, 60, 72]);
    const [n1, n2] = sample(rng, (x) => [x.int(2, 8), x.int(2, 8)], ([a, b]) => a !== b && total % a === 0 && total % b === 0);
    const t1 = total / n1;
    const t2 = total / n2;
    return valueTask({
      instruction: `${n1} ${c.who} ${c.task} ${t1} ${c.unit === 'Tage' ? 'Tagen' : c.unit}.`,
      prompt: plain(`Wie lange brauchen ${n2} ${c.who}?`),
      answer: t2,
      // wie proportional gerechnet, additiv gedacht, Produkt
      distractors: [r(t1 * n2, n1), t1 + (n1 - n2), total, t1],
      format: quantityFormat(c.unit),
      explanation: lines(
        'Mehr Arbeitende → weniger Zeit (antiproportional).',
        `${c.one}: ${t1} ${TIMES} ${n1} = ${total} ${c.unit}`,
        `${n2} ${c.who}: ${total} : ${n2} = ${t2} ${c.unit}`,
      ),
    });
  }
  const c = rng.pick(PROPORTIONAL);
  const unitPrice = c.money ? Rational.decimal(rng.int(2, 40) * 5, 2) : r(rng.int(8, 25));
  const [n1, n2] =
    difficulty === 'easy'
      ? (() => {
          const n = rng.int(2, 5);
          return [n, n * rng.int(2, 4)];
        })()
      : sample(rng, (x) => [x.int(2, 9), x.int(2, 12)], ([a, b]) => a !== b && b % a !== 0);
  const v1 = unitPrice.mul(n1);
  const v2 = unitPrice.mul(n2);
  const format = c.money ? moneyFormat() : quantityFormat(c.unit);
  const show = (v: Rational) => format(v).display.value;
  return valueTask({
    instruction: c.given(n1, show(v1)),
    prompt: plain(c.ask(n2)),
    answer: v2,
    // additiv statt proportional, mit dem Gesamtwert malgenommen, nur der Wert für 1
    distractors: [v1.add(n2 - n1), v1.mul(n2), unitPrice, v2.add(unitPrice)],
    format,
    explanation: lines(`${c.one}: ${show(v1)} : ${n1} = ${show(unitPrice)}`, `${n2}-mal so viel: ${n2} ${TIMES} ${show(unitPrice)} = ${show(v2)}`),
  });
});

// ---- Terme zusammenfassen --------------------------------------------------------------------

function summandText(term: LinearTerm, first: boolean): string {
  const text = term.format();
  if (first) return text;
  return text.startsWith(MINUS) ? ` ${MINUS} ${text.slice(1)}` : ` ${PLUS} ${text}`;
}

function termAnswer(term: LinearTerm): Answer {
  return textAnswer(plain(term.format()), term.key());
}

export const k7Terms = generator('k7-terms', ({ difficulty, rng }) => {
  if (difficulty === 'hard') {
    // 5x − (2x − 3): Minusklammer
    const [a, b, c] = [rng.int(3, 9), rng.int(1, 6), rng.int(1, 9)];
    const inner = LinearTerm.of({ x: b }, -c);
    const result = LinearTerm.of({ x: a }).sub(inner);
    return {
      prompt: { instruction: 'Löse die Klammer auf und fasse zusammen.', math: plain(`${a}x ${MINUS} (${inner.format()})`) },
      answer: termAnswer(result),
      distractors: [
        termAnswer(LinearTerm.of({ x: a - b }, -c)), // Vorzeichen in der Klammer nicht umgedreht
        termAnswer(LinearTerm.of({ x: a + b }, c)),
        termAnswer(LinearTerm.of({ x: a - b + c })), // alles zusammengezählt
      ],
      explanation: lines(
        'Minus vor der Klammer: alle Vorzeichen in der Klammer umdrehen.',
        `${a}x ${MINUS} (${inner.format()}) = ${a}x ${MINUS} ${b === 1 ? '' : b}x ${PLUS} ${c}`,
        `= ${result.format()}`,
      ),
    };
  }
  const variables = difficulty === 'medium' && rng.chance(0.5) ? ['a', 'b'] : ['x'];
  const count = difficulty === 'easy' ? 3 : 4;
  const summands = sample(
    rng,
    (x) =>
      Array.from({ length: count }, (_, i) =>
        i % 2 === 0 || variables.length > 1
          ? LinearTerm.of({ [x.pick(variables)]: difficulty === 'easy' ? x.int(1, 9) : signed(x, 1, 9) })
          : LinearTerm.constant(difficulty === 'easy' ? x.int(1, 9) : signed(x, 1, 9)),
      ),
    (list) => {
      const sum = list.reduce((acc, t) => acc.add(t), LinearTerm.constant(0));
      return sum.variables.length > 0 && list.some((t) => t.variables.length === 0 || variables.length > 1) && !list[0].format().startsWith(MINUS);
    },
  );
  const result = summands.reduce((acc, t) => acc.add(t), LinearTerm.constant(0));
  const prompt = summands.map((t, i) => summandText(t, i === 0)).join('');
  const allX = summands.reduce((acc, t) => acc + t.variables.reduce((s, v) => s + t.coefficient(v).num, 0) + t.constant.num, 0);
  const absolute = summands.reduce(
    (acc, t) => acc.add(LinearTerm.of(Object.fromEntries(t.variables.map((v) => [v, t.coefficient(v).abs()])), t.constant.abs())),
    LinearTerm.constant(0),
  );
  return {
    prompt: { instruction: 'Fasse zusammen.', math: plain(prompt) },
    answer: termAnswer(result),
    distractors: [
      termAnswer(absolute), // Minuszeichen übersehen
      termAnswer(LinearTerm.of({ [variables[0]]: allX })), // alles in einen Topf
      termAnswer(result.add(LinearTerm.constant(rng.pick([-2, 2])))),
      termAnswer(result.add(LinearTerm.of({ [variables[0]]: 1 }))),
    ],
    explanation: lines('Gleichartige Glieder zusammenfassen: Variablen zu Variablen, Zahlen zu Zahlen.', `${prompt} = ${result.format()}`),
  };
});

// ---- Einfache Gleichungen ----------------------------------------------------------------------

const solution = (v: Rational): Answer => ({ display: plain(`x = ${formatDecimal(v)}`), key: `n:${v.key()}`, value: v });

export const k7LinearEquations = generator('k7-linear-equations', ({ difficulty, rng }) => {
  const x = difficulty === 'hard' ? signed(rng, 1, 12) : rng.int(1, 15);

  return byDifficulty<GeneratedTask>(difficulty, {
    // x + 7 = 12  ·  4x = 28
    easy: () => {
      if (rng.chance(0.5)) {
        const b = signed(rng, 2, 20);
        const c = x + b;
        const left = LinearTerm.of({ x: 1 }, b);
        return valueTask({
          prompt: plain(`${left.format()} = ${formatInteger(c)}`),
          answer: x,
          distractors: [c + b, -x, x + 1, c],
          format: solution,
          explanation: lines(`${left.format()} = ${formatInteger(c)}   | ${b > 0 ? MINUS : PLUS} ${Math.abs(b)}`, `x = ${formatInteger(x)}`),
        });
      }
      const a = rng.int(2, 9);
      return valueTask({
        prompt: plain(`${a}x = ${formatInteger(a * x)}`),
        answer: x,
        distractors: [a * x - a, a * x * a, x + 1, x - 1],
        format: solution,
        explanation: lines(`${a}x = ${formatInteger(a * x)}   | : ${a}`, `x = ${formatInteger(x)}`),
      });
    },
    // 3x + 4 = 19
    medium: () => {
      const a = rng.int(2, 9);
      const b = signed(rng, 1, 20);
      const c = a * x + b;
      const left = LinearTerm.of({ x: a }, b);
      return valueTask({
        prompt: plain(`${left.format()} = ${formatInteger(c)}`),
        answer: x,
        // nicht geteilt, falsch herum umgeformt, Vorzeichen
        distractors: [c - b, r(c + b, a), -x, x + 1],
        format: solution,
        explanation: lines(
          `${left.format()} = ${formatInteger(c)}   | ${b > 0 ? MINUS : PLUS} ${Math.abs(b)}`,
          `${a}x = ${formatInteger(c - b)}   | : ${a}`,
          `x = ${formatInteger(x)}`,
        ),
      });
    },
    // 5x − 3 = 2x + 9
    hard: () => {
      const [a, d] = sample(rng, (y) => [y.int(2, 9), y.int(1, 8)], ([a, d]) => a !== d);
      const b = signed(rng, 1, 15);
      const e = a * x + b - d * x;
      const left = LinearTerm.of({ x: a }, b);
      const right = LinearTerm.of({ x: d }, e);
      return valueTask({
        prompt: plain(`${left.format()} = ${right.format()}`),
        answer: x,
        // x-Glied mit falschem Vorzeichen rübergebracht, Zahl falsch rübergebracht
        distractors: [r(e - b, a + d), r(e + b, a - d), -x, x + 1],
        format: solution,
        explanation: lines(
          `${left.format()} = ${right.format()}   | ${MINUS} ${d === 1 ? '' : d}x`,
          `${LinearTerm.of({ x: a - d }, b).format()} = ${formatInteger(e)}   | ${b > 0 ? MINUS : PLUS} ${Math.abs(b)}`,
          `${LinearTerm.of({ x: a - d }).format()} = ${formatInteger(e - b)}${a - d !== 1 ? `   | : ${formatInteger(a - d)}` : ''}`,
          `x = ${formatInteger(x)}`,
        ),
      });
    },
  });
});

// ---- Winkel im Dreieck --------------------------------------------------------------------

export const k7TriangleAngles = generator('k7-triangle-angles', ({ difficulty, rng }) => {
  const deg = degreeFormat();
  return byDifficulty<GeneratedTask>(difficulty, {
    easy: () => {
      const [alpha, beta] = sample(rng, (x) => [x.int(3, 14) * 5, x.int(3, 14) * 5], ([a, b]) => a + b < 170 && a !== b);
      const gamma = 180 - alpha - beta;
      return valueTask({
        instruction: 'Wie groß ist γ?',
        prompt: plain(`Dreieck: α = ${alpha}°, β = ${beta}°`),
        answer: gamma,
        // Winkelsumme 360° angenommen, nur addiert, Differenz
        distractors: [360 - alpha - beta, alpha + beta, Math.abs(alpha - beta), 90 - Math.min(alpha, beta)],
        format: deg,
        explanation: lines('Winkelsumme im Dreieck: 180°', `γ = 180° − ${alpha}° − ${beta}° = ${gamma}°`),
      });
    },
    medium: () => {
      if (rng.chance(0.5)) {
        const base = rng.int(6, 17) * 5;
        const top = 180 - 2 * base;
        return valueTask({
          instruction: 'Wie groß ist der Winkel an der Spitze?',
          prompt: plain(`Gleichschenkliges Dreieck: Basiswinkel ${base}°`),
          answer: top,
          // nur einen Basiswinkel abgezogen, verdoppelt
          distractors: [180 - base, 2 * base, base, 90 - base],
          format: deg,
          explanation: lines('Beide Basiswinkel sind gleich groß.', `180° − 2 ${TIMES} ${base}° = ${top}°`),
        });
      }
      const top = rng.int(2, 16) * 10;
      const base = (180 - top) / 2;
      return valueTask({
        instruction: 'Wie groß ist ein Basiswinkel?',
        prompt: plain(`Gleichschenkliges Dreieck: Winkel an der Spitze ${top}°`),
        answer: base,
        distractors: [180 - top, top, base + 10],
        format: deg,
        explanation: lines(`180° − ${top}° = ${180 - top}°`, `${180 - top}° : 2 = ${base}°`),
      });
    },
    hard: () => {
      const kind = rng.pick(['right', 'supplementary', 'vertical'] as const);
      const angle = rng.int(4, 16) * 5 + rng.pick([0, 2, 3]);
      if (kind === 'right') {
        return valueTask({
          instruction: 'Wie groß ist β?',
          prompt: plain(`Rechtwinkliges Dreieck: γ = 90°, α = ${angle}°`),
          answer: 90 - angle,
          distractors: [180 - angle, 90 + angle, angle, 360 - 90 - angle],
          format: deg,
          explanation: lines(`β = 180° − 90° − ${angle}° = ${90 - angle}°`),
        });
      }
      const supplementary = kind === 'supplementary';
      return valueTask({
        instruction: supplementary ? 'Wie groß ist der Nebenwinkel?' : 'Wie groß ist der Scheitelwinkel?',
        prompt: plain(`Winkel α = ${angle}°`),
        answer: supplementary ? 180 - angle : angle,
        // Neben- und Scheitelwinkel verwechselt, Ergänzung zu 90°
        distractors: supplementary ? [angle, 90 - angle, 360 - angle] : [180 - angle, 90 - angle, 360 - angle],
        format: deg,
        explanation: lines(
          supplementary ? 'Nebenwinkel ergänzen sich zu 180°.' : 'Scheitelwinkel sind gleich groß.',
          supplementary ? `180° − ${angle}° = ${180 - angle}°` : `Scheitelwinkel = ${angle}°`,
        ),
      });
    },
  });
});

// ---- Mittelwert, Median, Spannweite ---------------------------------------------------------

function dataList(rng: Rng, count: number, max: number): number[] {
  return Array.from({ length: count }, () => rng.int(1, max));
}

export const k7MeanMedian = generator('k7-mean-median', ({ difficulty, rng }) => {
  const listText = (xs: number[]) => xs.join('; ');
  return byDifficulty<GeneratedTask>(difficulty, {
    // Mittelwert (ganzzahlig)
    easy: () => {
      const xs = sample(rng, (x) => dataList(x, x.int(4, 5), 20), (xs) => xs.reduce((a, b) => a + b, 0) % xs.length === 0);
      const sum = xs.reduce((a, b) => a + b, 0);
      const mean = sum / xs.length;
      const sorted = [...xs].sort((a, b) => a - b);
      return valueTask({
        instruction: 'Berechne den Mittelwert.',
        prompt: plain(listText(xs)),
        answer: mean,
        // Median statt Mittelwert, durch falsche Anzahl geteilt, nur addiert
        distractors: [sorted[Math.floor(sorted.length / 2)], r(sum, xs.length - 1), sum, mean + 1],
        format: decimal,
        explanation: lines(`Summe: ${xs.join(' + ')} = ${sum}`, `Anzahl: ${xs.length}`, `Mittelwert: ${sum} : ${xs.length} = ${mean}`),
      });
    },
    // Median, ungerade Anzahl, unsortiert
    medium: () => {
      const xs = sample(rng, (x) => dataList(x, x.pick([5, 7]), 30), (xs) => {
        const sorted = [...xs].sort((a, b) => a - b);
        return sorted[Math.floor(xs.length / 2)] !== xs[Math.floor(xs.length / 2)] && new Set(xs).size === xs.length;
      });
      const sorted = [...xs].sort((a, b) => a - b);
      const median = sorted[Math.floor(xs.length / 2)];
      const sum = xs.reduce((a, b) => a + b, 0);
      return valueTask({
        instruction: 'Bestimme den Median (Zentralwert).',
        prompt: plain(listText(xs)),
        answer: median,
        // mittlere Zahl der unsortierten Liste, Mittelwert
        distractors: [xs[Math.floor(xs.length / 2)], r(Math.round(sum / xs.length)), sorted[Math.floor(xs.length / 2) + 1]],
        format: decimal,
        explanation: lines(`Sortiert: ${listText(sorted)}`, `Die Zahl in der Mitte ist ${median}.`),
      });
    },
    // Median bei gerader Anzahl oder Spannweite
    hard: () => {
      const xs = sample(rng, (x) => dataList(x, x.pick([6, 8]), 40), (xs) => new Set(xs).size === xs.length);
      const sorted = [...xs].sort((a, b) => a - b);
      if (rng.chance(0.5)) {
        const i = xs.length / 2;
        const median = r(sorted[i - 1] + sorted[i], 2);
        return valueTask({
          instruction: 'Bestimme den Median (Zentralwert).',
          prompt: plain(listText(xs)),
          answer: median,
          // nur eine der beiden mittleren Zahlen, unsortiert gerechnet
          distractors: [sorted[i - 1], sorted[i], r(xs[i - 1] + xs[i], 2)],
          format: decimal,
          explanation: lines(`Sortiert: ${listText(sorted)}`, `Mitte zwischen ${sorted[i - 1]} und ${sorted[i]}: (${sorted[i - 1]} + ${sorted[i]}) : 2 = ${formatDecimal(median)}`),
        });
      }
      const range = sorted.at(-1)! - sorted[0];
      return valueTask({
        instruction: 'Wie groß ist die Spannweite?',
        prompt: plain(listText(xs)),
        answer: range,
        // größter Wert, Summe aus Maximum und Minimum, erste minus letzte Zahl der Liste
        distractors: [sorted.at(-1)!, sorted.at(-1)! + sorted[0], Math.abs(xs[0] - xs.at(-1)!)],
        format: decimal,
        explanation: lines(`Größter Wert: ${sorted.at(-1)}, kleinster Wert: ${sorted[0]}`, `Spannweite: ${sorted.at(-1)} − ${sorted[0]} = ${range}`),
      });
    },
  });
});

export const GRADE_7_GENERATORS: readonly TaskGenerator[] = [
  k7Integers,
  k7Percent,
  k7Interest,
  k7RuleOfThree,
  k7Terms,
  k7LinearEquations,
  k7TriangleAngles,
  k7MeanMedian,
];
