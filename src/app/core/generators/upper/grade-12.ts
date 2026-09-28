import { plain, tex } from '../../models';
import { formatDecimal, formatInteger, formatRounded } from '../../math/format';
import { gcd } from '../../math/number-theory';
import { Polynomial } from '../../math/polynomial';
import { Rational } from '../../math/rational';
import { Rng } from '../../math/rng';
import { numberFormat, textAnswer } from '../answers';
import { Answer, GeneratedTask, TaskGenerator } from '../generator';
import { x1 } from '../middle/grade-8';
import { formAnswer, roundedFormat, signed, texValue, texVector } from '../middle/helpers';
import { byDifficulty, generator, lines, sample, valueTask } from '../task-helpers';

const r = Rational.of;
const texFraction = numberFormat('fraction', 'tex');

/** c · (inner)^n als LaTeX, ohne überflüssige 1 und Hochzahl 1 */
function scaledPower(c: number, inner: string, n: number): string {
  const factor = c === 1 ? '' : c === -1 ? '-' : String(c);
  const power = n === 1 ? `(${inner})` : `(${inner})^{${n}}`;
  return n === 0 ? String(c) : `${factor}${power}`;
}

/** c · e^{exponent} */
function scaledExp(c: string, exponent: string): string {
  return `${c === '1' ? '' : c === '-1' ? '-' : c}e^{${exponent}}`;
}

function xPower(n: number): string {
  return n === 0 ? '1' : n === 1 ? 'x' : `x^{${n}}`;
}

// ---- Ketten- und Produktregel ------------------------------------------------------------------

export const k12DerivativeAdvanced = generator('k12-derivative-advanced', ({ difficulty, rng }) =>
  byDifficulty<GeneratedTask>(difficulty, {
    // Kettenregel: (3x + 1)⁴
    easy: () => {
      const [a, b, n] = [rng.int(2, 5), signed(rng, 1, 9), rng.int(2, 5)];
      const inner = x1(a, b).format();
      return {
        prompt: { instruction: "Bestimme f'(x) (Kettenregel).", math: tex(`f(x) = (${inner})^{${n}}`) },
        answer: formAnswer(scaledPower(n * a, inner, n - 1)),
        distractors: [
          formAnswer(scaledPower(n, inner, n - 1)), // innere Ableitung vergessen
          formAnswer(scaledPower(n * a, inner, n)), // Exponent nicht verringert
          formAnswer(scaledPower(a, inner, n - 1)), // äußere Ableitung vergessen
        ],
        explanation: [plain('Äußere Ableitung mal innere Ableitung.'), tex(`f'(x) = ${n}(${inner})^{${n - 1}} \\cdot ${a} = ${scaledPower(n * a, inner, n - 1)}`)],
      };
    },
    // e-Funktion mit linearem Exponenten
    medium: () => {
      const [c, k, b] = [signed(rng, 1, 5), signed(rng, 2, 5), signed(rng, 1, 5)];
      const exponent = x1(k, b).format();
      return {
        prompt: { instruction: "Bestimme f'(x).", math: tex(`f(x) = ${scaledExp(String(c), exponent)}`) },
        answer: formAnswer(scaledExp(String(c * k), exponent)),
        distractors: [
          formAnswer(scaledExp(String(c), exponent)), // innere Ableitung vergessen
          formAnswer(`${c === 1 ? '' : `${c}`}(${exponent})e^{${x1(k, b - 1).format()}}`), // Potenzregel auf e angewendet
          formAnswer(scaledExp(String(k), exponent)), // Faktor vergessen
        ],
        explanation: [tex(`\\left(e^{g(x)}\\right)' = g'(x) \\cdot e^{g(x)}`), tex(`f'(x) = ${c} \\cdot ${k < 0 ? `(${k})` : k} \\cdot e^{${exponent}} = ${scaledExp(String(c * k), exponent)}`)],
      };
    },
    // Produktregel: x³ · e^{2x}
    hard: () => {
      // k = 1 ausgeschlossen: sonst fiele „innere Ableitung vergessen“ mit der Lösung zusammen
      const [n, k] = [rng.int(2, 4), rng.pick([-3, -2, -1, 2, 3])];
      const e = scaledExp('1', x1(k, 0).format());
      const first = `${n === 1 ? '' : n}${xPower(n - 1)}`;
      const second = `${k === 1 ? '' : k === -1 ? '-' : k}${xPower(n)}`;
      const sum = `\\left(${first} ${k < 0 ? '-' : '+'} ${second.replace(/^-/, '')}\\right)${e}`;
      return {
        prompt: { instruction: "Bestimme f'(x) (Produktregel).", math: tex(`f(x) = ${xPower(n)} \\cdot ${e}`) },
        answer: formAnswer(sum),
        distractors: [
          formAnswer(`${n * k}${xPower(n - 1)}${e}`), // Ableitungen einfach multipliziert
          formAnswer(`\\left(${first} + ${xPower(n)}\\right)${e}`), // innere Ableitung von e vergessen
          formAnswer(`${first}${e}`), // nur u' · v
          formAnswer(`${second}${e}`), // nur u · v'
        ],
        explanation: [tex(`(u \\cdot v)' = u' \\cdot v + u \\cdot v'`), tex(`u = ${xPower(n)}, \\; u' = ${first}, \\quad v = ${e}, \\; v' = ${scaledExp(String(k), x1(k, 0).format())}`), tex(`f'(x) = ${sum}`)],
      };
    },
  }),
);

// ---- e-Funktion und ln ------------------------------------------------------------------------------

export const k12ExpLn = generator('k12-exp-ln', ({ difficulty, rng }) =>
  byDifficulty<GeneratedTask>(difficulty, {
    easy: () => {
      const n = rng.int(2, 9);
      const [question, answer] = rng.pick([
        [`\\ln\\left(e^{${n}}\\right)`, String(n)],
        [`e^{\\ln(${n})}`, String(n)],
      ]);
      return {
        prompt: { instruction: 'Berechne.', math: tex(`${question} = \\;?`) },
        answer: formAnswer(answer),
        // ln und e heben sich auf – typische Fehler: e hoch n stehen gelassen, Kehrwert, Nachbar
        distractors: [formAnswer(`e^{${n}}`), formAnswer(`\\frac{1}{${n}}`), formAnswer(String(n + 1))],
        explanation: [plain('ln und e-Funktion heben sich gegenseitig auf.'), tex(`${question} = ${answer}`)],
      };
    },
    // e^{kx} = a  →  x = ln(a)/k
    medium: () => {
      const a = sample(rng, (g) => g.int(2, 20), (a) => ![1].includes(a));
      const k = rng.int(1, 4);
      const left = k === 1 ? 'e^{x}' : `e^{${k}x}`;
      const correct = k === 1 ? `x = \\ln(${a})` : `x = \\frac{\\ln(${a})}{${k}}`;
      return {
        prompt: { instruction: 'Löse die Gleichung.', math: tex(`${left} = ${a}`) },
        answer: formAnswer(correct),
        distractors: [
          formAnswer(`x = e^{${a}}`), // e statt ln
          formAnswer(k === 1 ? `x = \\frac{${a}}{e}` : `x = ${k}\\ln(${a})`), // durch e geteilt / mal k
          // ln(a/k) wäre bei a = k² (z. B. e^{2x} = 4) sogar richtig – dann ein anderer Fehler
          formAnswer(
            k === 1
              ? `x = \\ln(${a + 1})`
              : Math.abs(Math.log(a / k) - Math.log(a) / k) < 1e-12
                ? `x = \\ln(${a}) - ${k}`
                : `x = \\ln\\left(\\frac{${a}}{${k}}\\right)`,
          ),
        ],
        explanation: [tex(`${left} = ${a} \\quad | \\; \\ln`), tex(`${k === 1 ? '' : k}x = \\ln(${a})`), tex(correct)],
      };
    },
    // Ableitung von ln
    hard: () => {
      const kind = rng.pick(['scaled', 'inner', 'product'] as const);
      const a = rng.int(2, 9);
      const cases = {
        scaled: { f: `${a}\\ln(x)`, d: `\\frac{${a}}{x}`, wrong: [`\\frac{1}{${a}x}`, `\\frac{1}{x}`, `${a}\\ln(x) \\cdot \\frac{1}{x}`], why: `(a \\ln x)' = \\frac{a}{x}` },
        // ln(ax) = ln(a) + ln(x) → Ableitung 1/x (klassischer Fehler: a/x)
        inner: { f: `\\ln(${a}x)`, d: `\\frac{1}{x}`, wrong: [`\\frac{${a}}{x}`, `\\frac{1}{${a}x}`, `\\frac{1}{${a}}`], why: `\\left(\\ln(${a}x)\\right)' = \\frac{1}{${a}x} \\cdot ${a} = \\frac{1}{x}` },
        product: { f: 'x \\ln(x)', d: '\\ln(x) + 1', wrong: ['\\frac{1}{x}', '\\ln(x)', '1'], why: "(x \\ln x)' = 1 \\cdot \\ln x + x \\cdot \\frac{1}{x} = \\ln(x) + 1" },
      } as const;
      const c = cases[kind];
      return {
        prompt: { instruction: "Bestimme f'(x) für x > 0.", math: tex(`f(x) = ${c.f}`) },
        answer: formAnswer(c.d),
        distractors: c.wrong.map(formAnswer),
        explanation: [tex(`(\\ln x)' = \\frac{1}{x}`), tex(c.why)],
      };
    },
  }),
);

// ---- Integrale -------------------------------------------------------------------------------------

function randomIntegrand(rng: Rng, terms: number): Polynomial {
  const degrees = rng.shuffle([0, 1, 2, 3]).slice(0, terms);
  return Polynomial.of(...[0, 1, 2, 3].map((k) => (degrees.includes(k) ? signed(rng, 1, 6) * (k === 2 ? 3 : k === 1 ? 2 : k === 3 ? 4 : 1) : 0)));
}

function antiderivativeAnswer(F: Polynomial): Answer {
  return textAnswer(tex(`F(x) = ${F.format()} + C`), `F:${F.key()}`);
}

export const k12Integrals = generator('k12-integrals', ({ difficulty, rng }) => {
  if (difficulty === 'easy') {
    const f = randomIntegrand(rng, 2);
    const F = f.antiderivative();
    const raisedOnly = f.coefficients.reduce((acc, c, k) => acc.add(Polynomial.monomial(c, k + 1)), Polynomial.of(0));
    const dividedByN = f.coefficients.reduce((acc, c, k) => acc.add(Polynomial.monomial(k === 0 ? c : c.div(k), k + 1)), Polynomial.of(0));
    return {
      prompt: { instruction: 'Bestimme eine Stammfunktion F.', math: tex(`f(x) = ${f.format()}`) },
      answer: antiderivativeAnswer(F),
      distractors: [
        antiderivativeAnswer(raisedOnly), // Exponent erhöht, aber nicht geteilt
        antiderivativeAnswer(f.derivative()), // abgeleitet statt aufgeleitet
        antiderivativeAnswer(dividedByN), // durch den alten Exponenten geteilt
      ].filter((a) => a.key !== antiderivativeAnswer(F).key),
      explanation: [tex(`\\int x^{n}\\,dx = \\frac{x^{n+1}}{n+1} + C`), tex(`F(x) = ${F.format()} + C`)],
    };
  }
  const f = randomIntegrand(rng, difficulty === 'medium' ? 2 : 3);
  const [a, b] = difficulty === 'medium' ? [0, rng.int(1, 4)] : sample(rng, (g) => [g.int(-3, 1), g.int(1, 4)], ([a, b]) => a < b);
  const F = f.antiderivative();
  const value = F.evaluate(b).sub(F.evaluate(a));
  const raisedOnly = f.coefficients.reduce((acc, c, k) => acc.add(Polynomial.monomial(c, k + 1)), Polynomial.of(0));
  return valueTask({
    prompt: tex(`\\int_{${a}}^{${b}} \\left(${f.format()}\\right)\\,dx = \\;?`),
    answer: value,
    // Grenzen vertauscht, untere Grenze vergessen, abgeleitet statt aufgeleitet, nicht geteilt
    distractors: [value.neg(), F.evaluate(b), f.evaluate(b).sub(f.evaluate(a)), raisedOnly.evaluate(b).sub(raisedOnly.evaluate(a))],
    format: texFraction,
    explanation: [
      tex(`F(x) = ${F.format()}`),
      tex(`\\int_{${a}}^{${b}} f(x)\\,dx = F(${b}) - F(${a}) = ${texValue(F.evaluate(b))} - ${F.evaluate(a).sign < 0 ? `\\left(${texValue(F.evaluate(a))}\\right)` : texValue(F.evaluate(a))} = ${texValue(value)}`),
    ],
  });
});

// ---- Skalarprodukt -------------------------------------------------------------------------------

export const k12DotProduct = generator('k12-dot-product', ({ difficulty, rng }) => {
  const dims = rng.chance(0.4) ? 2 : 3;
  const vec = () => Array.from({ length: dims }, () => signed(rng, 1, 6));
  const dot = (u: number[], v: number[]) => u.reduce((s, x, i) => s + x * v[i], 0);

  return byDifficulty<GeneratedTask>(difficulty, {
    easy: () => {
      const [u, v] = [vec(), vec()];
      const value = dot(u, v);
      return valueTask({
        prompt: tex(`${texVector(u)} \\cdot ${texVector(v)} = \\;?`),
        answer: value,
        // über Kreuz multipliziert, Vorzeichen ignoriert, alles addiert
        distractors: [u.reduce((s, x, i) => s + x * v[(i + 1) % dims], 0), u.reduce((s, x, i) => s + Math.abs(x * v[i]), 0), u.reduce((s, x, i) => s + x + v[i], 0), value + 1],
        explanation: [tex(`${u.map((x, i) => `${x < 0 ? `(${x})` : x} \\cdot ${v[i] < 0 ? `(${v[i]})` : v[i]}`).join(' + ')} = ${value}`)],
      });
    },
    // orthogonal: für welches t?
    medium: () => {
      const v = vec();
      const pos = rng.int(0, dims - 1);
      v[pos] = signed(rng, 1, 2); // kleiner Eintrag bei t → t bleibt überschaubar
      // ganzzahliges t ≠ 0
      const u = sample(rng, vec, (u) => {
        const rest = dot(u, v) - u[pos] * v[pos];
        return rest !== 0 && rest % v[pos] === 0;
      });
      const rest = dot(u, v) - u[pos] * v[pos];
      const t = r(-rest, v[pos]);
      const shown = u.map((x, i) => (i === pos ? 't' : texValue(r(x))));
      return valueTask({
        instruction: 'Für welches t stehen die Vektoren senkrecht aufeinander?',
        prompt: tex(`\\begin{pmatrix} ${shown.join(' \\\\ ')} \\end{pmatrix}, \\quad ${texVector(v)}`),
        answer: t,
        // Vorzeichen, nicht geteilt, Skalarprodukt = 1 statt 0
        distractors: [t.neg(), r(-rest), r(1 - rest, v[pos]), r(rest)],
        format: (x) => ({ ...texFraction(x), display: tex(`t = ${texValue(x)}`) }),
        explanation: [plain('Senkrecht ⇔ Skalarprodukt = 0'), tex(`${rest} ${v[pos] < 0 ? '-' : '+'} ${Math.abs(v[pos])}t = 0 \\;\\Rightarrow\\; t = ${texValue(t)}`)],
      });
    },
    // Winkel zwischen zwei Vektoren
    hard: () => {
      const [u, v] = sample(rng, () => [vec(), vec()], ([u, v]) => dot(u, v) !== 0 && u.some((x, i) => x * v[0] !== v[i] * u[0]));
      const norm = (w: number[]) => Math.sqrt(dot(w, w));
      const cos = dot(u, v) / (norm(u) * norm(v));
      const angle = (Math.acos(cos) * 180) / Math.PI;
      const f = roundedFormat('°', 1);
      return {
        prompt: { instruction: 'Wie groß ist der Winkel zwischen den Vektoren? (auf eine Nachkommastelle)', math: tex(`${texVector(u)}, \\quad ${texVector(v)}`) },
        answer: f(angle),
        // Ergänzungswinkel, Bogenmaß, Skalarprodukt nicht durch die Längen geteilt
        distractors: [f(180 - angle), f(Math.acos(cos)), f(90 - angle)].filter((a) => a.key !== f(angle).key),
        explanation: [
          tex(`\\cos\\varphi = \\frac{\\vec a \\cdot \\vec b}{|\\vec a| \\cdot |\\vec b|} = \\frac{${dot(u, v)}}{\\sqrt{${dot(u, u)}} \\cdot \\sqrt{${dot(v, v)}}}`),
          tex(`\\varphi \\approx ${formatRounded(angle, 1, 'tex')}^{\\circ}`),
        ],
      };
    },
  });
});

// ---- Stochastik ------------------------------------------------------------------------------------

function binomial(n: number, k: number): number {
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return Math.round(result);
}

export const k12Stochastics = generator('k12-stochastics', ({ difficulty, rng }) =>
  byDifficulty<GeneratedTask>(difficulty, {
    // Erwartungswert B(n; p)
    easy: () => {
      const p = rng.pick([r(1, 10), r(1, 5), r(1, 4), r(1, 2), r(3, 10)]);
      const n = sample(rng, (g) => g.int(10, 60), (n) => p.mul(n).isInteger());
      const e = p.mul(n);
      return valueTask({
        instruction: 'Wie groß ist der Erwartungswert E(X)?',
        prompt: tex(`X \\sim B\\left(${n};\\, ${formatDecimal(p, 'tex')}\\right)`),
        answer: e,
        // Gegenwahrscheinlichkeit, Varianz statt Erwartungswert, durch p geteilt
        distractors: [Rational.ONE.sub(p).mul(n), e.mul(Rational.ONE.sub(p)), r(n).div(p), p],
        format: numberFormat(),
        explanation: [tex(`E(X) = n \\cdot p = ${n} \\cdot ${formatDecimal(p, 'tex')} = ${formatDecimal(e, 'tex')}`)],
      });
    },
    // P(X = k)
    medium: () => {
      const p = rng.pick([r(1, 2), r(1, 3)]);
      const n = rng.int(3, 5);
      const k = rng.int(1, n - 1);
      const value = p.pow(k).mul(Rational.ONE.sub(p).pow(n - k)).mul(binomial(n, k));
      const pTex = texValue(p);
      return valueTask({
        instruction: `Ein Versuch gelingt mit Wahrscheinlichkeit ${p.num}/${p.den}. Er wird ${n}-mal wiederholt. Wie groß ist P(X = ${k})?`,
        prompt: tex(`X \\sim B\\left(${n};\\, ${pTex}\\right), \\quad P(X = ${k}) = \\;?`),
        answer: value,
        // Binomialkoeffizient vergessen, Gegenwahrscheinlichkeit vergessen, k/n
        distractors: [p.pow(k).mul(Rational.ONE.sub(p).pow(n - k)), p.pow(k).mul(binomial(n, k)), r(k, n), value.mul(2)].filter((d) => d.compare(1) < 0),
        format: texFraction,
        explanation: [
          tex(`P(X = k) = \\binom{n}{k} p^{k} (1 - p)^{n-k}`),
          tex(`= \\binom{${n}}{${k}} \\cdot \\left(${pTex}\\right)^{${k}} \\cdot \\left(${texValue(Rational.ONE.sub(p))}\\right)^{${n - k}} = ${binomial(n, k)} \\cdot ${texValue(p.pow(k).mul(Rational.ONE.sub(p).pow(n - k)))} = ${texValue(value)}`),
        ],
      });
    },
    // bedingte Wahrscheinlichkeit aus einer Vierfeldertafel
    hard: () => {
      const total = rng.pick([100, 120, 150, 200, 240, 300]);
      const sport = sample(rng, (g) => g.int(3, 8) * (total / 10), (s) => s < total);
      const both = sample(rng, (g) => g.int(1, sport - 1), (b) => gcd(b, sport) > 1);
      const fruitOthers = rng.int(1, total - sport - 1);
      const fruit = both + fruitOthers;
      return valueTask({
        instruction: 'Wie groß ist die Wahrscheinlichkeit, dass eine sportliche Person täglich Obst isst?',
        prompt: plain(`Von ${formatInteger(total)} Befragten treiben ${sport} Sport. ${both} der Sportlichen und ${fruitOthers} der übrigen essen täglich Obst.`),
        answer: r(both, sport),
        // auf alle bezogen, falsche Bedingung P(S | O), Anteil der Obstesser
        distractors: [r(both, total), r(both, fruit), r(fruit, total)],
        format: texFraction,
        explanation: [tex(`P(\\text{Obst} \\mid \\text{Sport}) = \\frac{${both}}{${sport}} = ${texValue(r(both, sport))}`)],
      });
    },
  }),
);

export const GRADE_12_GENERATORS: readonly TaskGenerator[] = [k12DerivativeAdvanced, k12ExpLn, k12Integrals, k12DotProduct, k12Stochastics];
