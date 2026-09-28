import { plain, tex } from '../../models';
import { formatInteger, formatRounded } from '../../math/format';
import { LinearTerm } from '../../math/linear-term';
import { Polynomial } from '../../math/polynomial';
import { Rational } from '../../math/rational';
import { Rng } from '../../math/rng';
import { textAnswer } from '../answers';
import { Answer, GeneratedTask, TaskGenerator } from '../generator';
import { byDifficulty, generator, lines, quantityFormat, sample, valueTask } from '../task-helpers';
import { x1 } from './grade-8';
import { formAnswer, rootsAnswer, roundedFormat, signed, texPoint, texValue } from './helpers';

const r = Rational.of;

// ---- Lineare Gleichungssysteme ------------------------------------------------------------

function pairAnswer(x: number, y: number): Answer {
  return textAnswer(plain(`x = ${formatInteger(x)}, y = ${formatInteger(y)}`), `xy:${x},${y}`);
}

function equationTex(a: number, b: number, c: number): string {
  return `${LinearTerm.of({ x: a, y: b }).format('tex')} &= ${c}`;
}

export const k9LinearSystems = generator('k9-linear-systems', ({ difficulty, rng }) => {
  const range = difficulty === 'hard' ? 9 : 6;
  const [x, y] = sample(rng, (g) => [signed(g, 1, range), signed(g, 1, range)], ([x, y]) => x !== y && (difficulty !== 'easy' || (x > 0 && y > 0)));
  const [a1, b1, a2, b2] = byDifficulty<number[]>(difficulty, {
    easy: () => [1, 1, 1, -1],
    medium: () => sample(rng, (g) => [g.int(1, 3), signed(g, 1, 3), g.int(1, 3), signed(g, 1, 3)], ([a, b, c, d]) => a * d - b * c !== 0 && (Math.abs(b) === Math.abs(d) || a === c)),
    hard: () => sample(rng, (g) => [g.int(1, 5), signed(g, 1, 5), g.int(1, 5), signed(g, 1, 5)], ([a, b, c, d]) => a * d - b * c !== 0 && Math.abs(b) !== Math.abs(d) && a !== c),
  });
  const c1 = a1 * x + b1 * y;
  const c2 = a2 * x + b2 * y;
  const system = `\\begin{aligned} ${equationTex(a1, b1, c1)} \\\\ ${equationTex(a2, b2, c2)} \\end{aligned}`;
  const check = (a: number, b: number, c: number) => `${a} \\cdot (${x}) ${b < 0 ? '-' : '+'} ${Math.abs(b)} \\cdot (${y}) = ${c}`;
  return {
    prompt: { instruction: 'Löse das Gleichungssystem.', math: tex(system) },
    answer: pairAnswer(x, y),
    // x und y vertauscht, Vorzeichenfehler, beim Einsetzen verrechnet
    distractors: [pairAnswer(y, x), pairAnswer(x, -y), pairAnswer(-x, y), pairAnswer(x + 1, y - 1)],
    explanation: [
      plain(difficulty === 'easy' ? 'Beide Gleichungen addieren: y fällt weg.' : 'Additionsverfahren: Gleichungen so vervielfachen, dass eine Variable wegfällt.'),
      plain(`Lösung: x = ${formatInteger(x)}, y = ${formatInteger(y)}`),
      tex(`\\text{Probe: } ${check(a1, b1, c1)}`),
      tex(`\\text{Probe: } ${check(a2, b2, c2)}`),
    ],
  };
});

// ---- Quadratwurzeln ---------------------------------------------------------------------------

const SQUARE_FREE = [2, 3, 5, 6, 7, 10];

export const k9Roots = generator('k9-roots', ({ difficulty, rng }) =>
  byDifficulty<GeneratedTask>(difficulty, {
    easy: () => {
      const n = rng.int(2, 20);
      return valueTask({
        prompt: tex(`\\sqrt{${n * n}} = \\;?`),
        answer: n,
        // durch 2 geteilt, verdoppelt, Nachbar
        distractors: [r(n * n, 2), 2 * n, n + 1, n - 1],
        explanation: [tex(`${n}^{2} = ${n * n} \\;\\Rightarrow\\; \\sqrt{${n * n}} = ${n}`)],
      });
    },
    // √2 · √8 = 4   ·   √72 : √2 = 6
    medium: () => {
      const m = rng.pick(SQUARE_FREE);
      const [k1, k2] = [rng.int(1, 3), rng.int(2, 5)];
      const [a, b] = [m * k1 * k1, m * k2 * k2];
      if (rng.chance(0.5)) {
        const value = m * k1 * k2;
        return valueTask({
          prompt: tex(`\\sqrt{${a}} \\cdot \\sqrt{${b}} = \\;?`),
          answer: value,
          // Radikanden addiert, Wurzel vergessen
          distractors: [a * b, a + b, value + 1, k1 + k2],
          explanation: [tex(`\\sqrt{${a}} \\cdot \\sqrt{${b}} = \\sqrt{${a} \\cdot ${b}} = \\sqrt{${a * b}} = ${value}`)],
        });
      }
      const big = m * k2 * k2 * k1 * k1;
      return valueTask({
        prompt: tex(`\\sqrt{${big}} : \\sqrt{${m}} = \\;?`),
        answer: k1 * k2,
        distractors: [big / m, (k1 * k2) ** 2 / 2, k1 * k2 + 1, k1 + k2],
        explanation: [tex(`\\sqrt{${big}} : \\sqrt{${m}} = \\sqrt{${big} : ${m}} = \\sqrt{${(k1 * k2) ** 2}} = ${k1 * k2}`)],
      });
    },
    // teilweise Wurzel ziehen: √72 = 6√2
    hard: () => {
      const m = rng.pick(SQUARE_FREE);
      const k = rng.pick([2, 3, 4, 5, 6]);
      const radicand = k * k * m;
      const partialPrime = [2, 3].find((p) => k % p === 0 && p < k);
      return {
        prompt: { instruction: 'Ziehe die Wurzel so weit wie möglich.', math: tex(`\\sqrt{${radicand}}`) },
        answer: formAnswer(`${k}\\sqrt{${m}}`),
        distractors: [
          formAnswer(`${k * k}\\sqrt{${m}}`), // Quadratzahl vor die Wurzel statt ihre Wurzel
          formAnswer(`${m}\\sqrt{${k}}`), // vertauscht
          ...(partialPrime ? [formAnswer(`${k / partialPrime}\\sqrt{${partialPrime * partialPrime * m}}`)] : [formAnswer(`${k + 1}\\sqrt{${m}}`)]), // nur teilweise
        ],
        explanation: [tex(`\\sqrt{${radicand}} = \\sqrt{${k * k} \\cdot ${m}} = \\sqrt{${k * k}} \\cdot \\sqrt{${m}} = ${k}\\sqrt{${m}}`)],
      };
    },
  }),
);

// ---- Potenzgesetze ------------------------------------------------------------------------------

function powerOfA(k: number): string {
  return k === 0 ? '1' : k === 1 ? 'a' : `a^{${k}}`;
}

function powerAnswer(k: number): Answer {
  return textAnswer(tex(powerOfA(k)), `pow:${k}`);
}

export const k9PowerLaws = generator('k9-power-laws', ({ difficulty, rng }) => {
  const law = byDifficulty(difficulty, {
    easy: () => 'product' as const,
    medium: () => rng.pick(['quotient', 'power'] as const),
    hard: () => rng.pick(['negative', 'mixed'] as const),
  });
  const [m, n] = [rng.int(2, 9), rng.int(2, 6)];

  const cases = {
    product: { text: `a^{${m}} \\cdot a^{${n}}`, k: m + n, wrong: [m * n, m - n, m + n + 1], rule: 'a^{m} \\cdot a^{n} = a^{m+n}' },
    quotient: { text: `a^{${m + n}} : a^{${n}}`, k: m, wrong: [(m + n) * n, m + 2 * n, m - 1], rule: 'a^{m} : a^{n} = a^{m-n}' },
    power: { text: `\\left(a^{${m}}\\right)^{${n}}`, k: m * n, wrong: [m + n, m ** n, m * n + 1], rule: '\\left(a^{m}\\right)^{n} = a^{m \\cdot n}' },
    negative: { text: `a^{-${n}} \\cdot a^{${m + n}}`, k: m, wrong: [m + 2 * n, -n * (m + n), -m], rule: 'a^{m} \\cdot a^{n} = a^{m+n} \\quad (\\text{auch für negative } m, n)' },
    mixed: { text: `\\left(a^{${n}}\\right)^{2} : a^{${n + 1}}`, k: n - 1, wrong: [2 * n + n + 1, n + 3, 2 * n], rule: '\\left(a^{n}\\right)^{2} = a^{2n}, \\quad a^{m} : a^{n} = a^{m-n}' },
  } as const;
  const c = cases[law];
  return {
    prompt: { instruction: 'Vereinfache.', math: tex(c.text) },
    answer: powerAnswer(c.k),
    distractors: c.wrong.filter((w) => w !== c.k).map(powerAnswer),
    // falls Fehlermuster zusammenfallen (z. B. (a²)² : 2 + 2 = 2 · 2): Nachbar-Exponenten
    fallback: (g) => powerAnswer(c.k + g.pick([-2, -1, 1, 2])),
    explanation: [tex(c.rule), tex(`${c.text} = ${powerOfA(c.k)}`)],
  };
});

// ---- Quadratische Gleichungen ------------------------------------------------------------------

export const k9QuadraticEquations = generator('k9-quadratic-equations', ({ difficulty, rng }) => {
  if (difficulty === 'easy') {
    const n = rng.int(2, 12);
    const c = n * n;
    const form = rng.chance(0.5) ? `x^{2} = ${c}` : `x^{2} - ${c} = 0`;
    return {
      prompt: { instruction: 'Löse die Gleichung.', math: tex(form) },
      answer: rootsAnswer([-n, n]),
      // negative Lösung vergessen, Wurzel vergessen, halbiert
      distractors: [rootsAnswer([n]), rootsAnswer([-c, c]), rootsAnswer(c % 2 === 0 ? [-c / 2, c / 2] : [-(n + 1), n + 1])],
      explanation: [tex(`x^{2} = ${c} \\;\\Rightarrow\\; x = \\pm\\sqrt{${c}} = \\pm ${n}`)],
    };
  }

  const a = difficulty === 'hard' ? rng.pick([1, 2, 3]) : 1;
  if (difficulty === 'hard' && rng.chance(0.25)) {
    // keine reelle Lösung: x² + px + q = 0 mit D < 0
    const h = signed(rng, 1, 5);
    const d = rng.int(1, 9); // (x + h)² + d = 0
    const poly = x1(1, h).pow(2).add(Polynomial.of(d)).scale(a);
    return {
      prompt: { instruction: 'Löse die Gleichung.', math: tex(`${poly.format()} = 0`) },
      answer: rootsAnswer(null),
      // Minus unter der Wurzel übersehen
      distractors: [
        rootsAnswer(Number.isInteger(Math.sqrt(d)) ? [-h - Math.sqrt(d), -h + Math.sqrt(d)] : [-h - 1, -h + 1]),
        rootsAnswer([h - 1, h + 1]),
        rootsAnswer([-h]),
      ],
      explanation: [
        ...(a > 1 ? [tex(`\\text{Durch } ${a} \\text{ teilen: } ${poly.scale(r(1, a)).format()} = 0`)] : []),
        tex(`D = \\left(\\tfrac{p}{2}\\right)^{2} - q = ${h * h} - ${h * h + d} = ${-d} < 0`),
        plain('Die Zahl unter der Wurzel ist negativ → keine Lösung.'),
      ],
    };
  }

  const [r1, r2] = sample(rng, (g) => [signed(g, 1, 9), signed(g, 1, 9)], ([p, q]) => p < q && p + q !== 0);
  const poly = Polynomial.fromRoots(r1, r2).scale(a);
  const p = -(r1 + r2);
  const q = r1 * r2;
  const half = r(p, 2);
  return {
    prompt: { instruction: 'Löse die Gleichung.', math: tex(`${poly.format()} = 0`) },
    answer: rootsAnswer([r1, r2]),
    // Vorzeichen der Lösungen vertauscht, p/2 mit falschem Vorzeichen, nur eine Lösung
    distractors: [
      rootsAnswer([-r1, -r2]),
      rootsAnswer([r1, -r2]),
      rootsAnswer([r2]),
      ...(difficulty === 'hard' ? [rootsAnswer(null)] : []),
    ],
    explanation: [
      ...(a > 1 ? [tex(`\\text{Durch } ${a} \\text{ teilen: } ${Polynomial.fromRoots(r1, r2).format()} = 0`)] : []),
      tex(`p = ${p}, \\; q = ${q}`),
      tex(`x_{1,2} = ${texValue(half.neg())} \\pm \\sqrt{${texValue(half.mul(half))} - (${q})} = ${texValue(half.neg())} \\pm ${texValue(r(r2 - r1, 2))}`),
      plain(`x₁ = ${formatInteger(r1)}, x₂ = ${formatInteger(r2)}`),
    ],
  };
});

// ---- Scheitelpunkt einer Parabel ---------------------------------------------------------------

function vertexAnswer(d: number | Rational, e: number | Rational): Answer {
  const [dd, ee] = [Rational.from(d), Rational.from(e)];
  return textAnswer(tex(texPoint(dd, ee, 'S')), `pt:${dd.key()},${ee.key()}`);
}

export const k9ParabolaVertex = generator('k9-parabola-vertex', ({ difficulty, rng }) => {
  const [d, e] = sample(rng, (g) => [signed(g, 1, 8), signed(g, 1, 9)], ([d, e]) => Math.abs(d) !== Math.abs(e));
  if (difficulty === 'hard') {
    // Normalform: x² − 6x + 5 → quadratische Ergänzung
    const poly = x1(1, -d).pow(2).add(Polynomial.of(e));
    const b = poly.coefficient(1).num;
    const c = poly.coefficient(0).num;
    return {
      prompt: { instruction: 'Bestimme den Scheitelpunkt.', math: tex(`f(x) = ${poly.format()}`) },
      answer: vertexAnswer(d, e),
      // Vorzeichen von b/2, c übernommen, b statt b/2
      distractors: [vertexAnswer(-d, e), vertexAnswer(d, c), vertexAnswer(-b, c - b * b)],
      explanation: [
        tex(`f(x) = x^{2} ${b < 0 ? '-' : '+'} ${Math.abs(b)}x + \\left(\\tfrac{${Math.abs(b)}}{2}\\right)^{2} - \\left(\\tfrac{${Math.abs(b)}}{2}\\right)^{2} ${c < 0 ? '-' : '+'} ${Math.abs(c)}`),
        tex(`f(x) = ${`(${x1(1, -d).format()})^{2}`} ${e < 0 ? '-' : '+'} ${Math.abs(e)}`),
        tex(`S(${d} \\mid ${e})`),
      ],
    };
  }
  const a = difficulty === 'medium' ? sample(rng, (g) => signed(g, 1, 3), (a) => a !== 1) : 1;
  const inner = `(${x1(1, -d).format()})^{2}`;
  const form = `${a === 1 ? '' : a === -1 ? '-' : a}${inner} ${e < 0 ? '-' : '+'} ${Math.abs(e)}`;
  return {
    prompt: { instruction: 'Bestimme den Scheitelpunkt.', math: tex(`f(x) = ${form}`) },
    answer: vertexAnswer(d, e),
    // Vorzeichen in der Klammer übernommen, Koordinaten vertauscht, Vorzeichen von e
    distractors: [vertexAnswer(-d, e), vertexAnswer(e, d), vertexAnswer(d, -e), ...(a !== 1 ? [vertexAnswer(a * d, e)] : [])],
    explanation: [tex(`f(x) = a(x - d)^{2} + e \\;\\Rightarrow\\; S(d \\mid e)`), tex(`d = ${d}, \\; e = ${e} \\;\\Rightarrow\\; S(${d} \\mid ${e})`)],
  };
});

// ---- Satz des Pythagoras ------------------------------------------------------------------------

const TRIPLES: readonly [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41]];

function triple(rng: Rng): [number, number, number] {
  const [a, b, c] = rng.pick(TRIPLES);
  const k = a === 3 ? rng.int(1, 5) : rng.int(1, 2);
  return rng.chance(0.5) ? [a * k, b * k, c * k] : [b * k, a * k, c * k];
}

export const k9Pythagoras = generator('k9-pythagoras', ({ difficulty, rng }) => {
  const unit = rng.pick(['cm', 'm']);
  const len = quantityFormat(unit);
  if (difficulty === 'hard') {
    const [a, b] = sample(rng, (g) => [g.int(2, 15), g.int(2, 15)], ([a, b]) => !Number.isInteger(Math.sqrt(a * a + b * b)) && a !== b);
    const c = Math.sqrt(a * a + b * b);
    const rounded = roundedFormat(unit, 1);
    const task = {
      prompt: { instruction: 'Wie lang ist die Hypotenuse c? (auf eine Nachkommastelle gerundet)', math: plain(`a = ${a} ${unit}, b = ${b} ${unit}, γ = 90°`) },
      answer: rounded(c),
      // Wurzel vergessen, einfach addiert, subtrahiert statt addiert
      distractors: [rounded(a + b), rounded(Math.sqrt(Math.abs(a * a - b * b))), rounded(c + 1), rounded((a * a + b * b) / 2)].filter((x) => x.key !== rounded(c).key),
      explanation: lines(`c² = a² + b² = ${a * a} + ${b * b} = ${a * a + b * b}`, `c = √${a * a + b * b} ≈ ${formatRounded(c, 1)} ${unit}`),
    };
    return task;
  }
  const [a, b, c] = triple(rng);
  if (difficulty === 'easy') {
    return valueTask({
      instruction: 'Wie lang ist die Hypotenuse c?',
      prompt: plain(`a = ${a} ${unit}, b = ${b} ${unit}, γ = 90°`),
      answer: c,
      // Wurzel vergessen, Katheten einfach addiert
      distractors: [a * a + b * b, a + b, c + 1],
      format: len,
      explanation: lines(`c² = a² + b² = ${a * a} + ${b * b} = ${c * c}`, `c = √${c * c} = ${c} ${unit}`),
    });
  }
  return valueTask({
    instruction: 'Wie lang ist die Kathete b?',
    prompt: plain(`c = ${c} ${unit}, a = ${a} ${unit}, γ = 90°`),
    answer: b,
    // addiert statt subtrahiert, Wurzel vergessen, einfach subtrahiert
    distractors: [c * c - a * a, c - a, b + 1],
    format: len,
    explanation: lines(`b² = c² − a² = ${c * c} − ${a * a} = ${b * b}`, `b = √${b * b} = ${b} ${unit}`),
  });
});

// ---- Kreis --------------------------------------------------------------------------------------

export const k9Circle = generator('k9-circle', ({ difficulty, rng }) => {
  const unit = rng.pick(['cm', 'm']);
  const rr = rng.int(2, 15);
  const pi = Math.PI;
  return byDifficulty<GeneratedTask>(difficulty, {
    easy: () => {
      const f = roundedFormat(unit, 2);
      const u = 2 * pi * rr;
      return {
        prompt: { instruction: 'Berechne den Umfang (auf zwei Nachkommastellen).', math: plain(`Kreis: r = ${rr} ${unit}`) },
        answer: f(u),
        // 2 vergessen, Flächenformel, π vergessen
        distractors: [f(pi * rr), f(pi * rr * rr), f(2 * rr)],
        explanation: lines(`U = 2 · π · r = 2 · π · ${rr} ${unit} ≈ ${formatRounded(u, 2)} ${unit}`),
      };
    },
    medium: () => {
      const f = roundedFormat(`${unit}²`, 2);
      const area = pi * rr * rr;
      return {
        prompt: { instruction: 'Berechne den Flächeninhalt (auf zwei Nachkommastellen).', math: plain(`Kreis: r = ${rr} ${unit}`) },
        answer: f(area),
        // Umfangsformel, Durchmesser statt Radius, r nicht quadriert (bei r = 2 fällt die Umfangsformel mit der Lösung zusammen)
        distractors: [f(2 * pi * rr), f(pi * 4 * rr * rr), f(pi * rr), f(pi * rr * rr * 2)].filter((x) => x.key !== f(area).key),
        explanation: lines(`A = π · r² = π · ${rr}² ${unit}² ≈ ${formatRounded(area, 2)} ${unit}²`),
      };
    },
    hard: () => {
      const d = 2 * rr;
      const f = roundedFormat(`${unit}²`, 2);
      const area = pi * rr * rr;
      return {
        prompt: { instruction: 'Berechne den Flächeninhalt (auf zwei Nachkommastellen).', math: plain(`Kreis: d = ${d} ${unit}`) },
        answer: f(area),
        // Durchmesser als Radius, Umfang
        distractors: [f(pi * d * d), f(pi * d), f((pi * d * d) / 2)],
        explanation: lines(`r = d : 2 = ${rr} ${unit}`, `A = π · r² = π · ${rr}² ${unit}² ≈ ${formatRounded(area, 2)} ${unit}²`),
      };
    },
  });
});

export const GRADE_9_GENERATORS: readonly TaskGenerator[] = [
  k9LinearSystems,
  k9Roots,
  k9PowerLaws,
  k9QuadraticEquations,
  k9ParabolaVertex,
  k9Pythagoras,
  k9Circle,
];
