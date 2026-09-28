import { plain, tex } from '../../models';
import { formatDecimal, formatInteger, formatRounded } from '../../math/format';
import { gcd } from '../../math/number-theory';
import { Rational } from '../../math/rational';
import { numberFormat, textAnswer } from '../answers';
import { Answer, GeneratedTask, TaskGenerator } from '../generator';
import { byDifficulty, generator, lines, quantityFormat, sample, valueTask } from '../task-helpers';
import { roundedFormat, texValue } from './helpers';

const r = Rational.of;
const texFraction = numberFormat('fraction', 'tex');
const DEG = Math.PI / 180;

// ---- Potenzen mit rationalen Exponenten -----------------------------------------------------

export const k10RationalExponents = generator('k10-rational-exponents', ({ difficulty, rng }) => {
  // Basis = kᑫ, damit die q-te Wurzel aufgeht
  const [k, q] = sample(rng, (g) => [g.int(2, 5), g.int(2, 4)], ([k, q]) => k ** q <= 625);
  const base = k ** q;
  const p = byDifficulty(difficulty, {
    easy: () => 1,
    medium: () => sample(rng, (g) => g.int(2, 3), (p) => gcd(p, q) === 1),
    hard: () => -sample(rng, (g) => g.int(1, 2), (p) => gcd(p, q) === 1),
  });
  const exponent = r(p, q);
  const value = r(k).pow(p);
  const expTex = p < 0 ? `-\\frac{${-p}}{${q}}` : `\\frac{${p}}{${q}}`;
  const rootTex = q === 2 ? `\\sqrt{${base}}` : `\\sqrt[${q}]{${base}}`;
  return valueTask({
    prompt: tex(`${base}^{${expTex}} = \\;?`),
    answer: value,
    // Basis mal Exponent, Kehrwert beim negativen Exponenten vergessen, falsche Wurzel
    distractors: [exponent.mul(base), value.pow(-1), r(base).div(q), ...(Math.abs(p) > 1 ? [r(k)] : [r(k * k)])],
    format: texFraction,
    explanation: [
      tex(`a^{\\frac{p}{q}} = \\left(\\sqrt[q]{a}\\right)^{p}`),
      tex(`${base}^{${expTex}} = \\left(${rootTex}\\right)^{${p}} = ${k}^{${p}} = ${texValue(value)}`),
    ],
  });
});

// ---- Exponentielles Wachstum -----------------------------------------------------------------

export const k10Growth = generator('k10-growth', ({ difficulty, rng }) => {
  const start = rng.pick([200, 500, 800, 1000, 1200, 2000, 5000]);
  const p = rng.pick([2, 3, 4, 5, 8, 10]);
  const n = rng.int(2, 5);
  const money = roundedFormat('€', 2);

  return byDifficulty<GeneratedTask>(difficulty, {
    // Zinseszins
    easy: () => {
      const end = start * (1 + p / 100) ** n;
      return {
        prompt: { instruction: `Wie viel Geld ist nach ${n} Jahren auf dem Konto? (Zinseszins)`, math: plain(`${formatInteger(start)} € zu ${p} % pro Jahr`) },
        answer: money(end),
        // linear gerechnet (ohne Zinseszins), Wachstumsfaktor mal Jahre, nur ein Jahr
        distractors: [money(start * (1 + (p * n) / 100)), money(start * (1 + p / 100) * n), money(start * (1 + p / 100))],
        explanation: [tex(`K_n = K_0 \\cdot q^{n}, \\quad q = 1 + \\tfrac{${p}}{100} = ${formatDecimal(r(100 + p, 100), 'tex')}`), plain(`K${'₀₁₂₃₄₅₆₇₈₉'[n]} = ${formatInteger(start)} € · ${formatDecimal(r(100 + p, 100))}${'⁰¹²³⁴⁵⁶⁷⁸⁹'[n]} ≈ ${formatRounded(end, 2)} €`)],
      };
    },
    // Abnahme
    medium: () => {
      const end = start * (1 - p / 100) ** n;
      const unit = 'Tiere';
      const f = roundedFormat(unit, 0);
      return {
        prompt: { instruction: `Wie viele sind es nach ${n} Jahren? (auf ganze Zahlen gerundet)`, math: plain(`Bestand: ${formatInteger(start)} Tiere, Abnahme ${p} % pro Jahr`) },
        answer: f(end),
        // Zunahme statt Abnahme, linear gerechnet, ein Jahr zu wenig
        distractors: [f(start * (1 + p / 100) ** n), f(start * (1 - (p * n) / 100)), f(start * (1 - p / 100) ** (n - 1))],
        explanation: [tex(`q = 1 - \\tfrac{${p}}{100} = ${formatDecimal(r(100 - p, 100), 'tex')}`), tex(`${start} \\cdot ${formatDecimal(r(100 - p, 100), 'tex')}^{${n}} \\approx ${formatRounded(end, 0, 'tex')}`)],
      };
    },
    // Wachstumsrate aus zwei Werten (ein Jahr)
    hard: () => {
      const after = (start * (100 + p)) / 100;
      return valueTask({
        instruction: 'Um wie viel Prozent ist der Bestand in einem Jahr gewachsen?',
        prompt: plain(`von ${formatInteger(start)} auf ${formatDecimal(r(after))}`),
        answer: p,
        // Zuwachs absolut statt prozentual, Faktor statt Rate, auf den neuen Wert bezogen
        distractors: [r(after - start), r(100 + p), r(Math.round(((after - start) / after) * 1000), 10)],
        format: quantityFormat('%'),
        explanation: [tex(`q = \\frac{${formatDecimal(r(after), 'tex')}}{${start}} = ${formatDecimal(r(100 + p, 100), 'tex')}`), tex(`p = (q - 1) \\cdot 100\\,\\% = ${p}\\,\\%`)],
      });
    },
  });
});

// ---- Logarithmus ------------------------------------------------------------------------------

export const k10Logarithm = generator('k10-logarithm', ({ difficulty, rng }) =>
  byDifficulty<GeneratedTask>(difficulty, {
    easy: () => {
      const b = rng.pick([2, 10]);
      const n = b === 2 ? rng.int(2, 9) : rng.int(2, 6);
      const x = b ** n;
      return valueTask({
        prompt: tex(`\\log_{${b}}\\left(${formatInteger(x, 'tex')}\\right) = \\;?`),
        answer: n,
        // durch die Basis geteilt, Stellen gezählt, Nachbar
        distractors: [r(x, b), String(x).length, n + 1, n - 1],
        explanation: [tex(`${b}^{${n}} = ${formatInteger(x, 'tex')} \\;\\Rightarrow\\; \\log_{${b}}\\left(${formatInteger(x, 'tex')}\\right) = ${n}`)],
      });
    },
    medium: () => {
      const b = rng.int(3, 6);
      const n = sample(rng, (g) => g.int(2, 4), (n) => b ** n <= 1300);
      const x = b ** n;
      return valueTask({
        prompt: tex(`\\log_{${b}}\\left(${formatInteger(x, 'tex')}\\right) = \\;?`),
        answer: n,
        distractors: [r(x, b), n + 1, b * n, n - 1],
        explanation: [tex(`${b}^{${n}} = ${formatInteger(x, 'tex')} \\;\\Rightarrow\\; \\log_{${b}}\\left(${formatInteger(x, 'tex')}\\right) = ${n}`)],
      });
    },
    // negative und gebrochene Logarithmen
    hard: () => {
      if (rng.chance(0.5)) {
        const b = rng.int(2, 5);
        const n = sample(rng, (g) => g.int(1, 4), (n) => b ** n <= 256);
        return valueTask({
          prompt: tex(`\\log_{${b}}\\left(\\frac{1}{${b ** n}}\\right) = \\;?`),
          answer: -n,
          // Minus vergessen, Kehrwert
          distractors: [n, r(1, n), r(-1, n)],
          format: texFraction,
          explanation: [tex(`\\frac{1}{${b ** n}} = ${b}^{-${n}} \\;\\Rightarrow\\; \\log_{${b}}\\left(\\frac{1}{${b ** n}}\\right) = -${n}`)],
        });
      }
      const b = rng.int(2, 5);
      const m = rng.int(2, 3);
      return valueTask({
        prompt: tex(`\\log_{${b ** m}}\\left(${b}\\right) = \\;?`),
        answer: r(1, m),
        // Kehrwert, Basis durch Zahl
        distractors: [m, r(b ** m, b), r(-1, m)],
        format: texFraction,
        explanation: [tex(`${b ** m}^{\\frac{1}{${m}}} = ${m === 2 ? `\\sqrt{${b ** m}}` : `\\sqrt[${m}]{${b ** m}}`} = ${b} \\;\\Rightarrow\\; \\log_{${b ** m}}(${b}) = \\frac{1}{${m}}`)],
      });
    },
  }),
);

// ---- Trigonometrie ------------------------------------------------------------------------------

const EXACT: Record<string, string> = {
  '0': '0',
  '1/2': '\\frac{1}{2}',
  'r2/2': '\\frac{\\sqrt{2}}{2}',
  'r3/2': '\\frac{\\sqrt{3}}{2}',
  '1': '1',
  'r3/3': '\\frac{\\sqrt{3}}{3}',
  'r3': '\\sqrt{3}',
};

const TABLE: readonly { fn: 'sin' | 'cos' | 'tan'; angle: number; value: keyof typeof EXACT }[] = [
  { fn: 'sin', angle: 0, value: '0' }, { fn: 'sin', angle: 30, value: '1/2' }, { fn: 'sin', angle: 45, value: 'r2/2' }, { fn: 'sin', angle: 60, value: 'r3/2' }, { fn: 'sin', angle: 90, value: '1' },
  { fn: 'cos', angle: 0, value: '1' }, { fn: 'cos', angle: 30, value: 'r3/2' }, { fn: 'cos', angle: 45, value: 'r2/2' }, { fn: 'cos', angle: 60, value: '1/2' }, { fn: 'cos', angle: 90, value: '0' },
  { fn: 'tan', angle: 0, value: '0' }, { fn: 'tan', angle: 30, value: 'r3/3' }, { fn: 'tan', angle: 45, value: '1' }, { fn: 'tan', angle: 60, value: 'r3' },
];

function exactAnswer(key: string): Answer {
  return textAnswer(tex(EXACT[key]), `trig:${key}`);
}

export const k10Trigonometry = generator('k10-trigonometry', ({ difficulty, rng }) =>
  byDifficulty<GeneratedTask>(difficulty, {
    easy: () => {
      const entry = rng.pick(TABLE);
      // typische Verwechslung: sin ↔ cos beim gleichen Winkel, Nachbarwinkel
      const swapped = TABLE.find((t) => t.angle === entry.angle && t.fn === (entry.fn === 'sin' ? 'cos' : 'sin'))?.value;
      const others = Object.keys(EXACT).filter((k) => k !== entry.value && k !== swapped);
      const wrong = [...(swapped && swapped !== entry.value ? [swapped] : []), ...rng.shuffle(others)].slice(0, 3);
      return {
        prompt: { instruction: 'Welcher Wert ist exakt richtig?', math: tex(`\\${entry.fn}(${entry.angle}^{\\circ})`) },
        answer: exactAnswer(entry.value),
        distractors: wrong.map(exactAnswer),
        explanation: [tex(`\\${entry.fn}(${entry.angle}^{\\circ}) = ${EXACT[entry.value]}`), plain('Merkhilfe: sin 0°, 30°, 45°, 60°, 90° = ½√0, ½√1, ½√2, ½√3, ½√4')],
      };
    },
    // Seite im rechtwinkligen Dreieck
    medium: () => {
      const c = rng.int(4, 20);
      const alpha = rng.pick([20, 25, 35, 40, 50, 55, 65, 70]);
      const unit = 'cm';
      const f = roundedFormat(unit, 1);
      const askOpposite = rng.chance(0.5);
      const value = askOpposite ? c * Math.sin(alpha * DEG) : c * Math.cos(alpha * DEG);
      const wrongFn = askOpposite ? c * Math.cos(alpha * DEG) : c * Math.sin(alpha * DEG);
      return {
        prompt: {
          instruction: `Wie lang ist die ${askOpposite ? 'Gegenkathete a' : 'Ankathete b'} von α? (auf eine Nachkommastelle)`,
          math: plain(`Rechtwinkliges Dreieck: Hypotenuse c = ${c} ${unit}, α = ${alpha}°`),
        },
        answer: f(value),
        // sin und cos verwechselt, durch statt mal, tan
        distractors: [f(wrongFn), f(c / Math.sin(alpha * DEG)), f(c * Math.tan(alpha * DEG))].filter((a) => a.key !== f(value).key),
        explanation: [tex(askOpposite ? `\\sin\\alpha = \\frac{a}{c} \\;\\Rightarrow\\; a = c \\cdot \\sin\\alpha` : `\\cos\\alpha = \\frac{b}{c} \\;\\Rightarrow\\; b = c \\cdot \\cos\\alpha`), tex(`= ${c} \\cdot \\${askOpposite ? 'sin' : 'cos'}(${alpha}^{\\circ}) \\approx ${formatRounded(value, 1, 'tex')}\\,\\text{${unit}}`)],
      };
    },
    // Winkel aus zwei Seiten
    hard: () => {
      const [a, b] = sample(rng, (g) => [g.int(2, 15), g.int(2, 15)], ([a, b]) => a !== b);
      const alpha = Math.atan(a / b) / DEG;
      const f = roundedFormat('°', 1);
      return {
        prompt: { instruction: 'Wie groß ist der Winkel α? (auf eine Nachkommastelle)', math: plain(`Katheten: a = ${a} cm (gegenüber von α), b = ${b} cm, γ = 90°`) },
        answer: f(alpha),
        // Seiten vertauscht, sin statt tan, Bogenmaß
        // Seiten vertauscht, sin/cos statt tan (b als Hypotenuse), Taschenrechner im Bogenmaß
        distractors: [f(90 - alpha), f((a < b ? Math.asin(a / b) : Math.acos(b / a)) / DEG), f(Math.atan(a / b))].filter((x) => x.key !== f(alpha).key),
        explanation: [tex(`\\tan\\alpha = \\frac{a}{b} = \\frac{${a}}{${b}}`), tex(`\\alpha = \\tan^{-1}\\left(\\frac{${a}}{${b}}\\right) \\approx ${formatRounded(alpha, 1, 'tex')}^{\\circ}`)],
      };
    },
  }),
);

// ---- Zylinder, Kegel, Kugel ------------------------------------------------------------------------

export const k10Solids = generator('k10-solids', ({ difficulty, rng }) => {
  const rr = rng.int(2, 10);
  const h = rng.int(3, 15);
  const pi = Math.PI;
  const vol = roundedFormat('cm³', 1);
  const area = roundedFormat('cm²', 1);

  return byDifficulty<GeneratedTask>(difficulty, {
    easy: () => {
      const v = pi * rr * rr * h;
      return {
        prompt: { instruction: 'Berechne das Volumen (auf eine Nachkommastelle).', math: plain(`Zylinder: r = ${rr} cm, h = ${h} cm`) },
        answer: vol(v),
        // r nicht quadriert, Durchmesser genommen, Mantelfläche
        distractors: [vol(pi * rr * h), vol(pi * 4 * rr * rr * h), vol(2 * pi * rr * h)],
        explanation: lines(`V = π · r² · h = π · ${rr}² · ${h} ≈ ${formatRounded(v, 1)} cm³`),
      };
    },
    medium: () => {
      if (rng.chance(0.5)) {
        const v = (pi * rr * rr * h) / 3;
        return {
          prompt: { instruction: 'Berechne das Volumen (auf eine Nachkommastelle).', math: plain(`Kegel: r = ${rr} cm, h = ${h} cm`) },
          answer: vol(v),
          // 1/3 vergessen, halbiert statt gedrittelt
          distractors: [vol(pi * rr * rr * h), vol((pi * rr * rr * h) / 2), vol((pi * rr * h) / 3)],
          explanation: lines(`V = ⅓ · π · r² · h = ⅓ · π · ${rr}² · ${h} ≈ ${formatRounded(v, 1)} cm³`),
        };
      }
      const v = (4 / 3) * pi * rr ** 3;
      return {
        prompt: { instruction: 'Berechne das Volumen (auf eine Nachkommastelle).', math: plain(`Kugel: r = ${rr} cm`) },
        answer: vol(v),
        // Oberfläche, 4/3 vergessen, r² statt r³
        distractors: [vol(4 * pi * rr * rr), vol(pi * rr ** 3), vol((4 / 3) * pi * rr * rr)],
        explanation: lines(`V = 4/3 · π · r³ = 4/3 · π · ${rr}³ ≈ ${formatRounded(v, 1)} cm³`),
      };
    },
    hard: () => {
      const o = 2 * pi * rr * rr + 2 * pi * rr * h;
      return {
        prompt: { instruction: 'Berechne die Oberfläche (auf eine Nachkommastelle).', math: plain(`Zylinder: r = ${rr} cm, h = ${h} cm`) },
        answer: area(o),
        // nur Mantel, nur ein Deckel, Volumen
        distractors: [area(2 * pi * rr * h), area(pi * rr * rr + 2 * pi * rr * h), area(pi * rr * rr * h)],
        explanation: lines('O = 2 · Grundfläche + Mantel', `O = 2 · π · ${rr}² + 2 · π · ${rr} · ${h} ≈ ${formatRounded(o, 1)} cm²`),
      };
    },
  });
});

// ---- Baumdiagramme --------------------------------------------------------------------------------

/** Zweistufige Zufallsversuche mit typischen Fehlvorstellungen als Ablenker. */
const TWO_STAGE_EVENTS: readonly { text: string; p: Rational; wrong: Rational[]; explain: string }[] = [
  // „KK, KZ, ZZ – also 1/3“ ist der Klassiker
  { text: 'Eine Münze wird zweimal geworfen. P(zweimal Kopf)?', p: r(1, 4), wrong: [r(1, 3), r(1, 2), r(2, 4).add(r(1, 4))], explain: 'P = \\frac{1}{2} \\cdot \\frac{1}{2} = \\frac{1}{4}' },
  { text: 'Eine Münze wird dreimal geworfen. P(dreimal Kopf)?', p: r(1, 8), wrong: [r(1, 4), r(1, 6), r(3, 8), r(1, 2)], explain: 'P = \\frac{1}{2} \\cdot \\frac{1}{2} \\cdot \\frac{1}{2} = \\frac{1}{8}' },
  { text: 'Eine Münze wird zweimal geworfen. P(genau einmal Kopf)?', p: r(1, 2), wrong: [r(1, 4), r(1, 3), r(3, 4)], explain: 'P = P(KZ) + P(ZK) = \\frac{1}{4} + \\frac{1}{4} = \\frac{1}{2}' },
  { text: 'Eine Münze wird zweimal geworfen. P(mindestens einmal Kopf)?', p: r(3, 4), wrong: [r(1, 2), r(2, 3), r(1, 4)], explain: 'P = 1 - P(ZZ) = 1 - \\frac{1}{4} = \\frac{3}{4}' },
  { text: 'Eine Münze wird dreimal geworfen. P(mindestens einmal Kopf)?', p: r(7, 8), wrong: [r(3, 4), r(1, 2), r(3, 8)], explain: 'P = 1 - P(ZZZ) = 1 - \\frac{1}{8} = \\frac{7}{8}' },
  { text: 'Ein Würfel wird zweimal geworfen. P(zweimal eine 6)?', p: r(1, 36), wrong: [r(1, 6), r(2, 6), r(1, 12)], explain: 'P = \\frac{1}{6} \\cdot \\frac{1}{6} = \\frac{1}{36}' },
  { text: 'Ein Würfel wird zweimal geworfen. P(zweimal eine gerade Zahl)?', p: r(1, 4), wrong: [r(1, 2), r(1, 3), r(1, 9)], explain: 'P = \\frac{3}{6} \\cdot \\frac{3}{6} = \\frac{1}{4}' },
  { text: 'Ein Würfel wird zweimal geworfen. P(erst eine 1, dann eine 2)?', p: r(1, 36), wrong: [r(1, 18), r(2, 6), r(1, 12)], explain: 'P = \\frac{1}{6} \\cdot \\frac{1}{6} = \\frac{1}{36}' },
  { text: 'Ein Würfel wird zweimal geworfen. P(zweimal dieselbe Zahl)?', p: r(1, 6), wrong: [r(1, 36), r(1, 12), r(1, 3)], explain: 'P = 6 \\cdot \\frac{1}{36} = \\frac{1}{6}' },
];

export const k10TreeDiagrams = generator('k10-tree-diagrams', ({ difficulty, rng }) =>
  byDifficulty<GeneratedTask>(difficulty, {
    easy: () => {
      const e = rng.pick(TWO_STAGE_EVENTS);
      return valueTask({
        instruction: 'Wie groß ist die Wahrscheinlichkeit?',
        prompt: plain(e.text),
        answer: e.p,
        distractors: e.wrong,
        format: texFraction,
        explanation: [plain('Pfadregel: Wahrscheinlichkeiten entlang eines Pfades multiplizieren, Pfade addieren.'), tex(e.explain)],
      });
    },
    // mit Zurücklegen
    medium: () => {
      const [red, blue] = [rng.int(2, 6), rng.int(1, 6)];
      const n = red + blue;
      const p = r(red * red, n * n);
      return valueTask({
        instruction: 'Wie groß ist die Wahrscheinlichkeit?',
        prompt: plain(`Urne: ${red} rote, ${blue} blaue Kugeln. Zweimal ziehen mit Zurücklegen. P(2× rot)?`),
        answer: p,
        // ohne Zurücklegen gerechnet, addiert, nur einmal gezogen
        distractors: [r(red * (red - 1), n * (n - 1)), r(2 * red, n), r(red, n), r(red, n * n)],
        format: texFraction,
        explanation: [tex(`P = \\frac{${red}}{${n}} \\cdot \\frac{${red}}{${n}} = ${texValue(p)}`)],
      });
    },
    // ohne Zurücklegen  ·  mindestens eine 6
    hard: () => {
      if (rng.chance(0.5)) {
        const p = r(11, 36);
        return valueTask({
          instruction: 'Wie groß ist die Wahrscheinlichkeit?',
          prompt: plain('Ein Würfel wird zweimal geworfen. P(mindestens eine 6)?'),
          answer: p,
          // 1/6 + 1/6, genau eine 6, zwei Sechsen
          distractors: [r(1, 3), r(10, 36), r(1, 36), r(25, 36)],
          format: texFraction,
          explanation: [plain('Gegenereignis: keine 6.'), tex(`P = 1 - \\frac{5}{6} \\cdot \\frac{5}{6} = 1 - \\frac{25}{36} = \\frac{11}{36}`)],
        });
      }
      const [red, blue] = [rng.int(2, 7), rng.int(1, 6)];
      const n = red + blue;
      const p = r(red * (red - 1), n * (n - 1));
      return valueTask({
        instruction: 'Wie groß ist die Wahrscheinlichkeit?',
        prompt: plain(`Urne: ${red} rote, ${blue} blaue Kugeln. Zweimal ziehen ohne Zurücklegen. P(2× rot)?`),
        answer: p,
        // mit Zurücklegen gerechnet, nur beim Nenner abgezogen
        distractors: [r(red * red, n * n), r(red * red, n * (n - 1)), r(red, n)],
        format: texFraction,
        explanation: [tex(`P = \\frac{${red}}{${n}} \\cdot \\frac{${red - 1}}{${n - 1}} = ${texValue(p)}`)],
      });
    },
  }),
);

export const GRADE_10_GENERATORS: readonly TaskGenerator[] = [
  k10RationalExponents,
  k10Growth,
  k10Logarithm,
  k10Trigonometry,
  k10Solids,
  k10TreeDiagrams,
];

