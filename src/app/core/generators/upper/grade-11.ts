import { plain, tex } from '../../models';
import { formatInteger } from '../../math/format';
import { Polynomial } from '../../math/polynomial';
import { Rational } from '../../math/rational';
import { Rng } from '../../math/rng';
import { numberFormat, textAnswer } from '../answers';
import { Answer, GeneratedTask, TaskGenerator } from '../generator';
import { x1 } from '../middle/grade-8';
import { polyAnswer, rootsAnswer, signed, texPoint, texValue, texVector, vectorAnswer } from '../middle/helpers';
import { byDifficulty, generator, lines, sample, valueTask } from '../task-helpers';

const r = Rational.of;
const texFraction = numberFormat('fraction', 'tex');

/** Zufälliges Polynom mit `terms` Gliedern bis Grad `maxDegree`, höchster Koeffizient ≠ 0. */
function randomPolynomial(rng: Rng, maxDegree: number, terms: number, maxCoefficient = 9): Polynomial {
  const degrees = rng.shuffle(Array.from({ length: maxDegree + 1 }, (_, i) => i)).slice(0, terms);
  if (!degrees.includes(maxDegree)) degrees[0] = maxDegree;
  const coefficients = Array.from({ length: maxDegree + 1 }, (_, k) => (degrees.includes(k) ? signed(rng, 1, maxCoefficient) : 0));
  return Polynomial.of(...coefficients);
}

/** Ableitung mit typischem Fehler, gliedweise. */
function mapTerms(p: Polynomial, f: (c: Rational, k: number) => [Rational, number]): Polynomial {
  return p.coefficients.reduce((acc, c, k) => {
    if (c.sign === 0) return acc;
    const [nc, nk] = f(c, k);
    return nk < 0 ? acc : acc.add(Polynomial.monomial(nc, nk));
  }, Polynomial.of(0));
}

// ---- Nullstellen -------------------------------------------------------------------------------

export const k11RootsPolynomials = generator('k11-roots-polynomials', ({ difficulty, rng }) =>
  byDifficulty<GeneratedTask>(difficulty, {
    // x² − 9 = 0
    easy: () => {
      const n = rng.int(2, 12);
      const f = Polynomial.fromHighest(1, 0, -n * n);
      return {
        prompt: { instruction: 'Bestimme alle Nullstellen.', math: tex(`f(x) = ${f.format()}`) },
        answer: rootsAnswer([-n, n]),
        distractors: [rootsAnswer([n]), rootsAnswer([-n * n, n * n]), rootsAnswer([0, n])],
        explanation: [tex(`${f.format()} = 0 \\;\\Rightarrow\\; x^{2} = ${n * n} \\;\\Rightarrow\\; x = \\pm ${n}`)],
      };
    },
    // Linearfaktoren: f(x) = (x − 2)(x + 5)
    medium: () => {
      const [a, b] = sample(rng, (g) => [signed(g, 1, 9), signed(g, 1, 9)], ([a, b]) => a !== b && a !== -b);
      const factored = `(${x1(1, -a).format()})(${x1(1, -b).format()})`;
      return {
        prompt: { instruction: 'Bestimme alle Nullstellen.', math: tex(`f(x) = ${factored}`) },
        answer: rootsAnswer([a, b]),
        // Vorzeichen aus der Klammer übernommen, nur eine
        distractors: [rootsAnswer([-a, -b]), rootsAnswer([a, -b]), rootsAnswer([-a, b]), rootsAnswer([a])],
        explanation: [plain('Ein Produkt ist 0, wenn ein Faktor 0 ist (Satz vom Nullprodukt).'), tex(`${x1(1, -a).format()} = 0 \\Rightarrow x = ${a}, \\quad ${x1(1, -b).format()} = 0 \\Rightarrow x = ${b}`)],
      };
    },
    // x ausklammern: f(x) = x³ − 5x² + 6x = x(x² − 5x + 6)
    hard: () => {
      const [a, b] = sample(rng, (g) => [signed(g, 1, 6), signed(g, 1, 6)], ([a, b]) => a < b);
      const inner = Polynomial.fromRoots(a, b);
      const f = inner.mul(Polynomial.of(0, 1));
      return {
        prompt: { instruction: 'Bestimme alle Nullstellen.', math: tex(`f(x) = ${f.format()}`) },
        answer: rootsAnswer([0, a, b]),
        // x = 0 vergessen, Vorzeichen, nur x = 0
        distractors: [rootsAnswer([a, b]), rootsAnswer([0, -a, -b]), rootsAnswer([0])],
        explanation: [tex(`f(x) = x\\left(${inner.format()}\\right)`), tex(`x_1 = 0, \\quad ${inner.format()} = 0 \\Rightarrow x = ${a}, \\; x = ${b}`)],
      };
    },
  }),
);

// ---- Ableitungsregeln ------------------------------------------------------------------------------

export const k11DerivativeRules = generator('k11-derivative-rules', ({ difficulty, rng }) => {
  const f = byDifficulty(difficulty, {
    easy: () => randomPolynomial(rng, rng.int(2, 4), 2),
    medium: () => randomPolynomial(rng, rng.int(3, 5), 3),
    // mit Bruch-Koeffizienten: ⅓x³ − ½x² + …
    hard: () => {
      const p = randomPolynomial(rng, rng.int(3, 4), 3, 6);
      return mapTerms(p, (c, k) => [k >= 2 && rng.chance(0.6) ? c.div(k + rng.int(0, 1)) : c, k]);
    },
  });
  const d = f.derivative();
  return {
    prompt: { instruction: "Bestimme die Ableitung f'(x).", math: tex(`f(x) = ${f.format()}`) },
    answer: polyAnswer(d),
    distractors: [
      polyAnswer(mapTerms(f, (c, k) => [c.mul(k), k])), // Exponent nicht verringert
      polyAnswer(mapTerms(f, (c, k) => [c, k - 1])), // Exponent nicht als Faktor
      ...(f.coefficient(0).sign ? [polyAnswer(d.add(Polynomial.of(f.coefficient(0))))] : []), // Konstante stehen gelassen
      polyAnswer(mapTerms(f, (c, k) => [c.mul(k - 1), k - 1])),
    ],
    explanation: [tex(`\\left(a x^{n}\\right)' = n \\cdot a \\, x^{n-1}, \\quad (c)' = 0`), tex(`f'(x) = ${d.format()}`)],
  };
});

// ---- Steigung / Tangente an einer Stelle -----------------------------------------------------------

export const k11TangentSlope = generator('k11-tangent-slope', ({ difficulty, rng }) => {
  const f = randomPolynomial(rng, difficulty === 'easy' ? 2 : 3, difficulty === 'easy' ? 2 : 3, 5);
  const x0 = signed(rng, 1, 3);
  const d = f.derivative();
  const slope = d.evaluate(x0);
  if (difficulty === 'hard') {
    // Tangentengleichung
    const y0 = f.evaluate(x0);
    const tangent = Polynomial.of(y0.sub(slope.mul(x0)), slope);
    return {
      prompt: { instruction: `Bestimme die Gleichung der Tangente an der Stelle x₀ = ${formatInteger(x0)}.`, math: tex(`f(x) = ${f.format()}`) },
      answer: polyAnswer(tangent),
      distractors: [
        polyAnswer(Polynomial.of(y0, slope)), // Verschiebung vergessen: t(x) = m·x + f(x₀)
        polyAnswer(Polynomial.of(slope.sub(y0.mul(x0)), y0)), // m und f(x₀) vertauscht
        polyAnswer(Polynomial.of(y0.add(slope.mul(x0)), slope)), // Vorzeichen
        polyAnswer(Polynomial.of(0, slope)), // Achsenabschnitt vergessen
      ],
      // bei Steigung 0 oder f(x₀) = f'(x₀) fallen Fehlermuster zusammen → um den Achsenabschnitt variieren
      fallback: (g) => polyAnswer(tangent.add(Polynomial.of(g.pick([-3, -2, -1, 1, 2, 3])))),
      explanation: [
        tex(`f'(x) = ${d.format()}, \\quad f'(${x0}) = ${texValue(slope)}, \\quad f(${x0}) = ${texValue(y0)}`),
        tex(`t(x) = f'(x_0)\\,(x - x_0) + f(x_0) = ${texValue(slope)}\\left(x ${x0 < 0 ? '+' : '-'} ${Math.abs(x0)}\\right) ${y0.sign < 0 ? '-' : '+'} ${texValue(y0.abs())}`),
        tex(`t(x) = ${tangent.format()}`),
      ],
    };
  }
  const wrongDerivative = mapTerms(f, (c, k) => [c.mul(k), k]); // Exponent nicht verringert
  return valueTask({
    instruction: `Wie groß ist die Steigung an der Stelle x₀ = ${formatInteger(x0)}?`,
    prompt: tex(`f(x) = ${f.format()}`),
    answer: slope,
    // Funktionswert statt Steigung, falsche Ableitung, falsches Vorzeichen eingesetzt
    distractors: [f.evaluate(x0), wrongDerivative.evaluate(x0), d.evaluate(-x0), slope.add(1)],
    format: texFraction,
    explanation: [tex(`f'(x) = ${d.format()}`), tex(`f'(${x0}) = ${texValue(slope)}`)],
  });
});

// ---- Extrempunkte ---------------------------------------------------------------------------------

function extremumAnswer(kind: 'H' | 'T', x: Rational | number, y: Rational | number): Answer {
  const [xx, yy] = [Rational.from(x), Rational.from(y)];
  return textAnswer(tex(texPoint(xx, yy, kind)), `ext:${kind}:${xx.key()},${yy.key()}`);
}

export const k11Extrema = generator('k11-extrema', ({ difficulty, rng }) => {
  if (difficulty === 'easy') {
    // Parabel: genau ein Extrempunkt
    const [d, e] = [signed(rng, 1, 6), signed(rng, 1, 9)];
    const a = rng.pick([1, -1, 2, -2]);
    const f = x1(1, -d).pow(2).scale(a).add(Polynomial.of(e));
    const kind = a > 0 ? 'T' : 'H';
    const other = kind === 'T' ? 'H' : 'T';
    return {
      prompt: { instruction: 'Bestimme den Extrempunkt.', math: tex(`f(x) = ${f.format()}`) },
      answer: extremumAnswer(kind, d, e),
      // Hoch- und Tiefpunkt verwechselt, Vorzeichen, y-Wert nicht berechnet
      distractors: [extremumAnswer(other, d, e), extremumAnswer(kind, -d, f.evaluate(-d)), extremumAnswer(kind, d, 0)],
      explanation: [
        tex(`f'(x) = ${f.derivative().format()} = 0 \\;\\Rightarrow\\; x = ${d}`),
        tex(`f''(x) = ${texValue(r(2 * a))} ${a > 0 ? '> 0 \\Rightarrow \\text{Tiefpunkt}' : '< 0 \\Rightarrow \\text{Hochpunkt}'}`),
        tex(`f(${d}) = ${e} \\;\\Rightarrow\\; ${texPoint(d, e, kind)}`),
      ],
    };
  }
  // Kubisch: f'(x) = 3(x − p)(x − q), p + q gerade → ganze Koeffizienten
  const [p, q] = sample(rng, (g) => [signed(g, 1, 4), signed(g, 1, 4)], ([p, q]) => p < q && (p + q) % 2 === 0);
  const c = difficulty === 'hard' ? signed(rng, 1, 9) : 0;
  const f = Polynomial.of(c, 3 * p * q, (-3 * (p + q)) / 2, 1);
  const askHigh = rng.chance(0.5);
  const [x, kind] = askHigh ? [p, 'H' as const] : [q, 'T' as const];
  const y = f.evaluate(x);
  const otherX = askHigh ? q : p;
  return {
    prompt: { instruction: `Bestimme den ${askHigh ? 'Hochpunkt' : 'Tiefpunkt'}.`, math: tex(`f(x) = ${f.format()}`) },
    answer: extremumAnswer(kind, x, y),
    distractors: [
      extremumAnswer(kind, otherX, f.evaluate(otherX)), // Hoch- und Tiefpunkt verwechselt
      extremumAnswer(kind, x, y.neg()), // Vorzeichen beim y-Wert
      extremumAnswer(kind, -x, f.evaluate(-x)),
      extremumAnswer(kind, x, f.derivative().derivative().evaluate(x)), // f'' statt f eingesetzt
    ],
    explanation: [
      tex(`f'(x) = ${f.derivative().format()} = 3(${x1(1, -p).format()})(${x1(1, -q).format()})`),
      tex(`x = ${p} \\text{ oder } x = ${q}`),
      tex(`f''(${x}) = ${texValue(f.derivative().derivative().evaluate(x))} ${askHigh ? '< 0 \\Rightarrow \\text{Hochpunkt}' : '> 0 \\Rightarrow \\text{Tiefpunkt}'}`),
      tex(`f(${x}) = ${texValue(y)} \\;\\Rightarrow\\; ${texPoint(x, y, kind)}`),
    ],
  };
});

// ---- Vektoren ------------------------------------------------------------------------------------

const TRIPLES_2D = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17]];
const TRIPLES_3D = [[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [2, 6, 9, 11], [4, 4, 7, 9]];

export const k11Vectors = generator('k11-vectors', ({ difficulty, rng }) => {
  const dims = rng.chance(0.5) ? 2 : 3;
  return byDifficulty<GeneratedTask>(difficulty, {
    // Addition
    easy: () => {
      const a = Array.from({ length: dims }, () => signed(rng, 1, 9));
      const b = Array.from({ length: dims }, () => signed(rng, 1, 9));
      const sum = a.map((v, i) => v + b[i]);
      return {
        prompt: { instruction: 'Berechne die Summe.', math: tex(`${texVector(a)} + ${texVector(b)}`) },
        answer: vectorAnswer(sum),
        // subtrahiert, komponentenweise multipliziert, Vorzeichen in einer Komponente
        distractors: [vectorAnswer(a.map((v, i) => v - b[i])), vectorAnswer(a.map((v, i) => v * b[i])), vectorAnswer(sum.map((v, i) => (i === 0 ? -v : v)))],
        explanation: [plain('Komponentenweise addieren.'), tex(`${texVector(a)} + ${texVector(b)} = ${texVector(sum)}`)],
      };
    },
    // Betrag
    medium: () => {
      const t = rng.pick(dims === 2 ? TRIPLES_2D : TRIPLES_3D);
      const comps = rng.shuffle(t.slice(0, -1)).map((v) => v * rng.sign());
      const length = t.at(-1)!;
      const squares = comps.reduce((s, v) => s + v * v, 0);
      return valueTask({
        instruction: 'Berechne den Betrag (die Länge) des Vektors.',
        prompt: tex(`\\left|${texVector(comps)}\\right|`),
        answer: length,
        // Wurzel vergessen, Komponenten addiert, Beträge addiert
        distractors: [squares, comps.reduce((s, v) => s + v, 0), comps.reduce((s, v) => s + Math.abs(v), 0)],
        explanation: [tex(`\\sqrt{${comps.map((v) => (v < 0 ? `(${v})^{2}` : `${v}^{2}`)).join(' + ')}} = \\sqrt{${squares}} = ${length}`)],
      });
    },
    // Verbindungsvektor AB = B − A
    hard: () => {
      const [A, B] = sample(
        rng,
        () => [Array.from({ length: dims }, () => signed(rng, 0, 9)), Array.from({ length: dims }, () => signed(rng, 0, 9))],
        ([A, B]) => A.some((v) => v !== 0) && A.some((v, i) => v !== B[i]),
      );
      const ab = B.map((v, i) => v - A[i]);
      const names = ['A', 'B'];
      const pt = (p: number[], n: string) => `${n}(${p.map((v) => texValue(r(v))).join(' \\mid ')})`;
      return {
        prompt: { instruction: 'Bestimme den Vektor von A nach B.', math: tex(`${pt(A, names[0])}, \\quad ${pt(B, names[1])}`) },
        answer: vectorAnswer(ab),
        // A − B statt B − A, addiert
        distractors: [vectorAnswer(ab.map((v) => -v)), vectorAnswer(A.map((v, i) => v + B[i])), vectorAnswer(B), vectorAnswer(A)],
        explanation: [tex(`\\overrightarrow{AB} = B - A = ${texVector(ab)}`), plain('„Spitze minus Fuß“')],
      };
    },
  });
});

export const GRADE_11_GENERATORS: readonly TaskGenerator[] = [k11RootsPolynomials, k11DerivativeRules, k11TangentSlope, k11Extrema, k11Vectors];
