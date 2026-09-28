import { plain, tex } from '../../models';
import { formatDecimal, formatInteger } from '../../math/format';
import { gcd } from '../../math/number-theory';
import { Polynomial } from '../../math/polynomial';
import { Rational } from '../../math/rational';
import { numberFormat } from '../answers';
import { GeneratedTask, TaskGenerator } from '../generator';
import { TIMES } from '../primary/helpers';
import { byDifficulty, generator, lines, quantityFormat, sample, valueTask } from '../task-helpers';
import { formAnswer, point, polyAnswer, signed, solutionFormat, texPoint, texValue } from './helpers';

const r = Rational.of;
/** ax + b */
export const x1 = (a: number, b: number) => Polynomial.of(b, a);
const texFraction = numberFormat('fraction', 'tex');

/** „3(x - 4)“ – Faktor vor der Klammer, auch negativ oder mit x */
export function bracket(factor: string, inner: Polynomial): string {
  return `${factor}(${inner.format()})`;
}

// ---- Ausmultiplizieren und Ausklammern ---------------------------------------------------

export const k8ExpandFactor = generator('k8-expand-factor', ({ difficulty, rng }) =>
  byDifficulty<GeneratedTask>(difficulty, {
    // 3(x − 4) = 3x − 12
    easy: () => {
      const a = rng.int(2, 9);
      const b = signed(rng, 1, 9);
      const inner = x1(1, b);
      const result = inner.scale(a);
      return {
        prompt: { instruction: 'Multipliziere aus.', math: tex(bracket(String(a), inner)) },
        answer: polyAnswer(result),
        distractors: [
          polyAnswer(x1(a, b)), // nur das erste Glied malgenommen
          polyAnswer(x1(a, -a * b)), // Vorzeichen verloren
          polyAnswer(x1(1, a * b)),
        ],
        explanation: [tex(`${bracket(String(a), inner)} = ${a} \\cdot x ${b < 0 ? '-' : '+'} ${a} \\cdot ${Math.abs(b)} = ${result.format()}`)],
      };
    },
    // −2(3x − 5)  ·  2x(3x − 1)
    medium: () => {
      const [a, b] = [rng.int(2, 6), signed(rng, 1, 9)];
      const inner = x1(a, b);
      if (rng.chance(0.5)) {
        const f = -rng.int(2, 6);
        const result = inner.scale(f);
        return {
          prompt: { instruction: 'Multipliziere aus.', math: tex(bracket(String(f), inner)) },
          answer: polyAnswer(result),
          // Minus nur beim ersten Glied, Minus ganz vergessen
          distractors: [polyAnswer(x1(f * a, -f * b)), polyAnswer(inner.scale(-f)), polyAnswer(x1(f * a, b))],
          explanation: [plain('Minus vor der Klammer: Jedes Vorzeichen in der Klammer dreht sich um.'), tex(`${bracket(String(f), inner)} = ${result.format()}`)],
        };
      }
      const f = rng.int(2, 6);
      const factor = Polynomial.monomial(f, 1); // f·x
      const result = inner.mul(factor);
      return {
        prompt: { instruction: 'Multipliziere aus.', math: tex(bracket(`${f}x`, inner)) },
        answer: polyAnswer(result),
        // x · x = x statt x², Zahl nicht mit x malgenommen
        distractors: [
          polyAnswer(Polynomial.of(0, f * a + f * b)), // x · x = x statt x², dann zusammengefasst
          polyAnswer(Polynomial.fromHighest(f * a, 0, f * b)), // Zahl nicht mit x malgenommen
          polyAnswer(Polynomial.of(f * b, f * a)), // x ganz vergessen
        ],
        explanation: [tex(`${f}x \\cdot ${a}x = ${f * a}x^{2}, \\quad ${f}x \\cdot ${b < 0 ? `(${b})` : b} = ${f * b}x`), tex(`= ${result.format()}`)],
      };
    },
    // Ausklammern: 12x + 18 = 6(2x + 3)
    hard: () => {
      const g = rng.int(2, 9);
      const [a, b] = sample(rng, (x) => [x.int(1, 9), signed(x, 1, 9)], ([a, b]) => gcd(a, Math.abs(b)) === 1 && !(a === 1 && Math.abs(b) === 1));
      const expanded = x1(a * g, b * g);
      const full = bracket(String(g), x1(a, b));
      const partialFactor = [2, 3, 5].find((p) => g % p === 0 && p < g);
      return {
        prompt: { instruction: 'Klammere den größten gemeinsamen Faktor aus.', math: tex(expanded.format()) },
        answer: formAnswer(full),
        distractors: [
          formAnswer(bracket(String(g), x1(a, b * g))), // zweites Glied nicht geteilt
          ...(partialFactor ? [formAnswer(bracket(String(partialFactor), x1((a * g) / partialFactor, (b * g) / partialFactor)))] : []), // nicht der größte Faktor
          formAnswer(bracket(String(g), x1(a * g, b))),
          formAnswer(bracket(`${g}x`, x1(a, b))),
        ],
        explanation: [plain(`ggT(${a * g}, ${Math.abs(b * g)}) = ${g}`), tex(`${expanded.format()} = ${g} \\cdot ${a}x ${b < 0 ? '-' : '+'} ${g} \\cdot ${Math.abs(b)} = ${full}`)],
      };
    },
  }),
);

// ---- Binomische Formeln -------------------------------------------------------------------

export const k8Binomial = generator('k8-binomial', ({ difficulty, rng }) => {
  const a = rng.int(1, 9);
  const b = difficulty === 'hard' ? rng.int(2, 5) : 1; // (bx + a)²
  const kind = difficulty === 'easy' ? 'plus' : rng.pick(['plus', 'minus', 'third'] as const);

  if (difficulty === 'hard' && rng.chance(0.5)) {
    // rückwärts: x² + 10x + 25 = (x + 5)²
    const sign = rng.sign();
    const expanded = x1(1, sign * a).pow(2);
    const correct = `(x ${sign < 0 ? '-' : '+'} ${a})^{2}`;
    return {
      prompt: { instruction: 'Schreibe als Quadrat (binomische Formel).', math: tex(expanded.format()) },
      answer: formAnswer(correct),
      distractors: [
        formAnswer(`(x ${sign < 0 ? '+' : '-'} ${a})^{2}`), // Vorzeichen
        formAnswer(`(x ${sign < 0 ? '-' : '+'} ${a * a})^{2}`), // Quadrat statt Wurzel
        formAnswer(`(x ${sign < 0 ? '-' : '+'} ${2 * a})^{2}`), // Mischglied halbiert vergessen
      ],
      explanation: [tex(`${expanded.format()} = x^{2} ${sign < 0 ? '-' : '+'} 2 \\cdot ${a} \\cdot x + ${a}^{2} = ${correct}`)],
    };
  }

  const left = x1(b, a);
  const right = x1(b, -a);
  const [base, result, label, formula] =
    kind === 'plus'
      ? [`(${left.format()})^{2}`, left.pow(2), '1. binomische Formel', '(a + b)^{2} = a^{2} + 2ab + b^{2}']
      : kind === 'minus'
        ? [`(${right.format()})^{2}`, right.pow(2), '2. binomische Formel', '(a - b)^{2} = a^{2} - 2ab + b^{2}']
        : [`(${left.format()})(${right.format()})`, left.mul(right), '3. binomische Formel', '(a + b)(a - b) = a^{2} - b^{2}'];
  const square = Polynomial.monomial(b * b, 2);
  const mixed = 2 * a * b * (kind === 'minus' ? -1 : 1);
  return {
    prompt: { instruction: 'Multipliziere aus.', math: tex(base) },
    answer: polyAnswer(result),
    distractors: [
      polyAnswer(square.add(Polynomial.of(kind === 'third' ? a * a : a * a))), // Mischglied vergessen / Vorzeichen
      polyAnswer(square.add(Polynomial.of(a * a, mixed / 2))), // Mischglied nicht verdoppelt
      polyAnswer(square.add(Polynomial.of(-a * a, kind === 'third' ? 2 * a * b : mixed))),
      polyAnswer(square.add(Polynomial.of(a * a, -mixed))),
    ],
    explanation: [plain(label), tex(formula), tex(`${base} = ${result.format()}`)],
  };
});

// ---- Gleichungen mit Klammern -------------------------------------------------------------

export const k8EquationsBrackets = generator('k8-equations-brackets', ({ difficulty, rng }) => {
  const x = signed(rng, 1, 12);
  const [a, b] = [rng.int(2, 6), signed(rng, 1, 9)];
  const leftPoly = x1(a, a * b); // a(x + b)

  return byDifficulty<GeneratedTask>(difficulty, {
    // 3(x + 2) = 21
    easy: () => {
      const c = leftPoly.evaluate(x);
      return valueTask({
        prompt: tex(`${bracket(String(a), x1(1, b))} = ${texValue(c)}`),
        answer: x,
        // nur das x malgenommen, durch a vergessen
        distractors: [r(c.num - b, a), c.sub(a * b), x + 1, -x],
        format: solutionFormat(),
        explanation: [
          tex(`${bracket(String(a), x1(1, b))} = ${texValue(c)} \\quad | \\; \\text{ausmultiplizieren}`),
          tex(`${leftPoly.format()} = ${texValue(c)} \\quad | ${a * b < 0 ? '+' : '-'} ${Math.abs(a * b)}`),
          tex(`${a}x = ${texValue(c.sub(a * b))} \\quad | : ${a}`),
          plain(`x = ${formatInteger(x)}`),
        ],
      });
    },
    // 2(x − 3) = x + 4
    medium: () => {
      const d = sample(rng, (y) => y.int(1, 5), (d) => d !== a);
      const e = leftPoly.evaluate(x).sub(d * x);
      const right = x1(d, e.num);
      return valueTask({
        prompt: tex(`${bracket(String(a), x1(1, b))} = ${right.format()}`),
        answer: x,
        distractors: [r(e.num - b, a - d), r(e.num + a * b, a - d), -x, x + 2],
        format: solutionFormat(),
        explanation: [
          tex(`${leftPoly.format()} = ${right.format()} \\quad | -${d === 1 ? '' : d}x`),
          tex(`${x1(a - d, a * b).format()} = ${texValue(e)}`),
          plain(`x = ${formatInteger(x)}`),
        ],
      });
    },
    // 4(x + 1) − 2(x − 3) = 20
    hard: () => {
      const [c, d] = sample(rng, (y) => [y.int(2, 5), signed(y, 1, 6)], ([c]) => c !== a);
      const whole = leftPoly.sub(x1(c, c * d));
      const value = whole.evaluate(x);
      return valueTask({
        prompt: tex(`${bracket(String(a), x1(1, b))} - ${bracket(String(c), x1(1, d))} = ${texValue(value)}`),
        answer: x,
        // Minus vor der zweiten Klammer nur auf das erste Glied angewendet
        distractors: [r(value.num - a * b - c * d, a - c), r(value.num - a * b, a + c), -x, x + 1],
        format: solutionFormat(),
        explanation: [
          tex(`${leftPoly.format()} ${x1(-c, -c * d).format().startsWith('-') ? '' : '+'} ${x1(-c, -c * d).format()} = ${texValue(value)}`),
          tex(`${whole.format()} = ${texValue(value)}`),
          plain(`x = ${formatInteger(x)}`),
        ],
      });
    },
  });
});

// ---- Lineare Funktionen -----------------------------------------------------------------------

export const k8LinearFunctions = generator('k8-linear-functions', ({ difficulty, rng }) => {
  const m = signed(rng, 1, 6);
  const b = signed(rng, 1, 9);
  const f = x1(m, b);

  return byDifficulty<GeneratedTask>(difficulty, {
    easy: () => {
      const askSlope = rng.chance(0.5);
      return valueTask({
        instruction: askSlope ? 'Wie groß ist die Steigung m?' : 'Wo schneidet der Graph die y-Achse? (y-Achsenabschnitt b)',
        prompt: tex(`f(x) = ${f.format()}`),
        answer: askSlope ? m : b,
        // m und b verwechselt, Vorzeichen
        distractors: askSlope ? [b, -m, m + 1] : [m, -b, b + 1],
        format: numberFormat(),
        explanation: lines('f(x) = m · x + b', `m = ${formatDecimal(r(m))}, b = ${formatDecimal(r(b))}`),
      });
    },
    // Steigung durch zwei Punkte
    medium: () => {
      const xa = rng.int(-4, 3);
      const dx = rng.int(1, 5);
      const [xb, ya] = [xa + dx, f.evaluate(xa)];
      const yb = f.evaluate(xb);
      const dy = yb.sub(ya);
      return valueTask({
        instruction: 'Wie groß ist die Steigung der Geraden durch die Punkte?',
        prompt: plain(`${point(xa, ya, 'A')} und ${point(xb, yb, 'B')}`),
        answer: m,
        // Δx : Δy, Differenz nicht geteilt, Vorzeichen
        distractors: [r(dx).div(dy), dy, -m, r(m + 1)],
        format: texFraction,
        explanation: [tex(`m = \\frac{y_B - y_A}{x_B - x_A} = \\frac{${texValue(dy)}}{${dx}} = ${m}`)],
      });
    },
    // Funktionsgleichung aus Steigung und Punkt  ·  Nullstelle
    hard: () => {
      if (rng.chance(0.5)) {
        const px = signed(rng, 1, 4);
        const py = f.evaluate(px);
        return {
          prompt: { instruction: 'Die Gerade hat die Steigung m und geht durch P. Wie lautet f(x)?', math: tex(`m = ${m}, \\quad ${texPoint(px, py)}`) },
          answer: polyAnswer(f),
          distractors: [
            polyAnswer(x1(m, py.num)), // y-Wert als b genommen
            polyAnswer(x1(m, py.num + m * px)), // Vorzeichen beim Umstellen
            polyAnswer(x1(py.num, m)),
          ],
          explanation: [tex(`${texValue(py)} = ${m} \\cdot ${px < 0 ? `(${px})` : px} + b`), tex(`b = ${texValue(py)} ${m * px < 0 ? '+' : '-'} ${Math.abs(m * px)} = ${b}`), tex(`f(x) = ${f.format()}`)],
        };
      }
      const zero = r(-b, m);
      return valueTask({
        instruction: 'Wo liegt die Nullstelle?',
        prompt: tex(`f(x) = ${f.format()}`),
        answer: zero,
        // Vorzeichen, b als Nullstelle, m und b vertauscht
        distractors: [zero.neg(), r(b), r(-m, b), r(b, m)],
        format: (v) => ({ ...texFraction(v), display: tex(`x = ${texValue(v)}`) }),
        explanation: [tex(`${f.format()} = 0`), tex(`${m === 1 ? '' : m === -1 ? '-' : m}x = ${-b}`), tex(`x = ${texValue(zero)}`)],
      });
    },
  });
});

// ---- Flächen: Dreieck, Parallelogramm, Trapez ----------------------------------------------------

export const k8Areas = generator('k8-areas', ({ difficulty, rng }) => {
  const unit = rng.pick(['cm', 'm', 'mm']);
  const sq = quantityFormat(`${unit}²`);
  const len = quantityFormat(unit);

  return byDifficulty<GeneratedTask>(difficulty, {
    easy: () => {
      const [g, h] = sample(rng, (x) => [x.int(2, 20), x.int(2, 20)], ([g, h]) => (g * h) % 2 === 0);
      return valueTask({
        instruction: 'Berechne den Flächeninhalt.',
        prompt: plain(`Dreieck: g = ${g} ${unit}, h = ${h} ${unit}`),
        answer: (g * h) / 2,
        // nicht halbiert, addiert
        distractors: [g * h, g + h, (g + h) / 2],
        format: sq,
        explanation: lines(`A = g ${TIMES} h : 2 = ${g} ${TIMES} ${h} : 2 = ${(g * h) / 2} ${unit}²`),
      });
    },
    medium: () => {
      if (rng.chance(0.5)) {
        const [g, h] = [rng.int(2, 20), rng.int(2, 20)];
        return valueTask({
          instruction: 'Berechne den Flächeninhalt.',
          prompt: plain(`Parallelogramm: g = ${g} ${unit}, h = ${h} ${unit}`),
          answer: g * h,
          distractors: [(g * h) / 2, 2 * (g + h), g + h],
          format: sq,
          explanation: lines(`A = g ${TIMES} h = ${g} ${TIMES} ${h} = ${g * h} ${unit}²`),
        });
      }
      const [a, c, h] = sample(rng, (x) => [x.int(4, 20), x.int(2, 15), x.int(2, 12)], ([a, c, h]) => a !== c && ((a + c) * h) % 2 === 0);
      return valueTask({
        instruction: 'Berechne den Flächeninhalt.',
        prompt: plain(`Trapez: a = ${a} ${unit}, c = ${c} ${unit}, h = ${h} ${unit}`),
        answer: ((a + c) * h) / 2,
        // nicht halbiert, nur eine Seite
        distractors: [(a + c) * h, a * c * h, (a * h) / 2 + c],
        format: sq,
        explanation: lines(`A = (a + c) : 2 ${TIMES} h`, `= (${a} + ${c}) : 2 ${TIMES} ${h} = ${((a + c) * h) / 2} ${unit}²`),
      });
    },
    // Höhe aus Fläche
    hard: () => {
      const [g, h] = sample(rng, (x) => [x.int(2, 20), x.int(2, 20)], ([g, h]) => (g * h) % 2 === 0);
      const area = (g * h) / 2;
      return valueTask({
        instruction: 'Wie groß ist die Höhe h?',
        prompt: plain(`Dreieck: A = ${area} ${unit}², g = ${g} ${unit}`),
        answer: h,
        // nicht verdoppelt, subtrahiert
        distractors: [area / g, area - g, 2 * area - g],
        format: len,
        explanation: lines(`A = g ${TIMES} h : 2  →  h = 2 ${TIMES} A : g`, `h = 2 ${TIMES} ${area} : ${g} = ${h} ${unit}`),
      });
    },
  });
});

// ---- Laplace-Wahrscheinlichkeit ----------------------------------------------------------------

const DIE_EVENTS: readonly { text: string; outcomes: number[] }[] = [
  { text: 'eine gerade Zahl', outcomes: [2, 4, 6] },
  { text: 'eine ungerade Zahl', outcomes: [1, 3, 5] },
  { text: 'eine Zahl größer als 4', outcomes: [5, 6] },
  { text: 'eine Zahl kleiner als 3', outcomes: [1, 2] },
  { text: 'eine Primzahl', outcomes: [2, 3, 5] },
  { text: 'eine 6', outcomes: [6] },
  { text: 'eine Zahl von 2 bis 5', outcomes: [2, 3, 4, 5] },
  { text: 'eine Zahl, die durch 3 teilbar ist', outcomes: [3, 6] },
];

function probabilityTask(prompt: string, instruction: string, favorable: number, total: number, wrong: Rational[], explanation: string[]): GeneratedTask {
  const p = r(favorable, total);
  return valueTask({
    instruction,
    prompt: plain(prompt),
    answer: p,
    // Wahrscheinlichkeiten liegen zwischen 0 und 1 – alles andere wäre kein sinnvoller Ablenker
    distractors: wrong.filter((w) => w.sign > 0 && w.compare(1) < 0),
    format: texFraction,
    explanation: [plain('P = günstige Ergebnisse : mögliche Ergebnisse'), ...explanation.map((e) => tex(e)), tex(`P = \\frac{${favorable}}{${total}}${p.den !== total ? ` = ${texValue(p)}` : ''}`)],
  });
}

export const k8Laplace = generator('k8-laplace', ({ difficulty, rng }) =>
  byDifficulty<GeneratedTask>(difficulty, {
    easy: () => {
      const e = rng.pick(DIE_EVENTS);
      const k = e.outcomes.length;
      return probabilityTask(
        `Ein Würfel wird einmal geworfen. P(${e.text})?`,
        'Wie groß ist die Wahrscheinlichkeit?',
        k,
        6,
        // günstig : ungünstig, 1 : Anzahl, falsche Grundmenge
        [r(k, 6 - k), r(1, k), r(k, 5), r(6 - k, 6)],
        [`\\text{günstig: } ${e.outcomes.join(', ')}`],
      );
    },
    // Urne
    medium: () => {
      const [red, blue] = [rng.int(1, 9), rng.int(1, 9)];
      const green = rng.chance(0.4) ? rng.int(1, 6) : 0;
      const total = red + blue + green;
      const contents = `${red} rote, ${blue} blaue${green ? ` und ${green} grüne` : ''} Kugeln`;
      return probabilityTask(
        `In einer Urne sind ${contents}. Eine Kugel wird gezogen. P(rot)?`,
        'Wie groß ist die Wahrscheinlichkeit?',
        red,
        total,
        // rot : blau, 1 : Anzahl der Farben, blau
        [r(red, blue + green), r(1, green ? 3 : 2), r(blue, total), r(red, total + 1)],
        [`\\text{rot: } ${red}, \\quad \\text{insgesamt: } ${total}`],
      );
    },
    // Zwei Würfel: Augensumme
    hard: () => {
      const sum = rng.int(3, 11);
      const favorable = 6 - Math.abs(7 - sum);
      return probabilityTask(
        `Zwei Würfel werden geworfen. P(Augensumme ${sum})?`,
        'Wie groß ist die Wahrscheinlichkeit?',
        favorable,
        36,
        // Summen als gleich wahrscheinlich angesehen, Summe durch 36, Paare doppelt/halb gezählt
        [r(1, 11), r(sum, 36), r(favorable, 12), r(Math.ceil(favorable / 2), 36)],
        [`\\text{36 gleich wahrscheinliche Paare, davon ${favorable} mit Summe ${sum}}`],
      );
    },
  }),
);

export const GRADE_8_GENERATORS: readonly TaskGenerator[] = [k8ExpandFactor, k8Binomial, k8EquationsBrackets, k8LinearFunctions, k8Areas, k8Laplace];

