import { Difficulty, plain, tex } from '../../models';
import { formatDecimal, formatFraction, formatInteger } from '../../math/format';
import { divisors, gcd, lcm } from '../../math/number-theory';
import { Rational } from '../../math/rational';
import { Rng } from '../../math/rng';
import { numberFormat, textAnswer } from '../answers';
import { Answer, GeneratedTask, TaskGenerator } from '../generator';
import { MINUS, PLUS, TIMES } from '../primary/helpers';
import { byDifficulty, generator, lines, pickOperation, quantityFormat, sample, valueTask } from '../task-helpers';

const r = Rational.of;
const texFraction = numberFormat('fraction', 'tex');
const decimal = numberFormat('decimal', 'plain');

/** \frac{a}{b} ohne Kürzen – für Aufgaben, bei denen die Schreibweise zählt. */
function frac(num: number, den: number): string {
  return `\\frac{${num}}{${den}}`;
}

function fracText(value: Rational): string {
  return formatFraction(value, 'tex');
}

/** Antwort, bei der die Form zählt (12/18 ist nicht „vollständig gekürzt“, auch wenn der Wert stimmt). */
function formAnswer(num: number, den: number): Answer {
  return textAnswer(tex(frac(num, den)), `f:${num}/${den}`);
}

/** Echter, gekürzter Bruch p/q mit q in [minDen, maxDen]. */
function properFraction(rng: Rng, minDen: number, maxDen: number): Rational {
  return sample(
    rng,
    (x) => {
      const q = x.int(minDen, maxDen);
      return r(x.int(1, q - 1), q);
    },
    (f) => f.den >= minDen,
  );
}

// ---- Kürzen, Erweitern, Vergleichen -------------------------------------------------------

export const k6FractionSimplify = generator('k6-fraction-simplify', ({ difficulty, rng }) =>
  byDifficulty<GeneratedTask>(difficulty, {
    // 12/18 vollständig kürzen
    easy: () => {
      const base = properFraction(rng, 2, 9);
      const k = rng.pick([4, 6, 8, 9, 10, 12]);
      const [n, d] = [base.num * k, base.den * k];
      const partial = divisors(k).filter((x) => x > 1 && x < k);
      const g = rng.pick(partial);
      return {
        prompt: { instruction: 'Kürze vollständig.', math: tex(frac(n, d)) },
        answer: formAnswer(base.num, base.den),
        distractors: [
          formAnswer(n / g, d / g), // nur teilweise gekürzt
          formAnswer(base.den, base.num), // Kehrwert
          ...(n - k > 0 ? [formAnswer(n - k, d - k)] : []), // subtrahiert statt dividiert
        ],
        explanation: [
          plain(`ggT(${n}, ${d}) = ${k * gcd(base.num, base.den)}`),
          tex(`${frac(n, d)} = \\frac{${n} : ${k}}{${d} : ${k}} = ${frac(base.num, base.den)}`),
        ],
      };
    },
    // 3/4 auf den Nenner 20 erweitern
    medium: () => {
      const base = properFraction(rng, 2, 9);
      const k = rng.int(2, 9);
      const target = base.den * k;
      return {
        prompt: { instruction: `Erweitere auf den Nenner ${target}.`, math: tex(frac(base.num, base.den)) },
        answer: formAnswer(base.num * k, target),
        distractors: [
          formAnswer(base.num, target), // nur den Nenner geändert
          formAnswer(base.num + (target - base.den), target), // Zähler um den gleichen Betrag vergrößert
          ...(base.num * base.den !== base.num * k ? [formAnswer(base.num * base.den, target)] : []),
        ],
        explanation: [plain(`${base.den} ${TIMES} ${k} = ${target}`), tex(`\\frac{${base.num} \\cdot ${k}}{${base.den} \\cdot ${k}} = ${frac(base.num * k, target)}`)],
      };
    },
    hard: () => {
      if (rng.chance(0.5)) {
        // Welcher Bruch ist gleich 2/3?  (klassischer Fehler: Zähler und Nenner um das Gleiche vergrößern)
        const base = properFraction(rng, 3, 9);
        const k = rng.int(2, 6);
        const add = rng.int(1, 5);
        return {
          prompt: { instruction: 'Welcher Bruch hat den gleichen Wert?', math: tex(frac(base.num, base.den)) },
          answer: formAnswer(base.num * k, base.den * k),
          distractors: [
            formAnswer(base.num + add, base.den + add),
            formAnswer(base.num * k, base.den * k + k),
            formAnswer(base.num * k + 1, base.den * k),
          ],
          explanation: [tex(`\\frac{${base.num} \\cdot ${k}}{${base.den} \\cdot ${k}} = ${frac(base.num * k, base.den * k)}`), plain('Zähler und Nenner mit derselben Zahl malnehmen.')],
        };
      }
      // Welcher Bruch ist am größten?
      const fractions = sample(
        rng,
        (x) => [properFraction(x, 3, 12), properFraction(x, 3, 12), properFraction(x, 3, 12)],
        (fs) =>
          new Set(fs.map((f) => f.key())).size === 3 &&
          new Set(fs.map((f) => f.den)).size >= 2 &&
          fs.reduce((l, f) => lcm(l, f.den), 1) <= 60,
      );
      const sorted = [...fractions].sort((a, b) => b.compare(a));
      const common = fractions.reduce((l, f) => lcm(l, f.den), 1);
      const toAnswer = (f: Rational) => textAnswer(tex(fracText(f)), `f:${f.key()}`);
      return {
        prompt: { instruction: 'Welcher Bruch ist am größten?', math: plain('Vergleiche die Brüche.') },
        answer: toAnswer(sorted[0]),
        distractors: sorted.slice(1).map(toAnswer),
        explanation: [
          plain(`Gemeinsamer Nenner: ${common}`),
          tex(fractions.map((f) => `${fracText(f)} = ${frac(f.num * (common / f.den), common)}`).join(',\\quad ')),
        ],
      };
    },
  }),
);

// ---- Brüche addieren und subtrahieren ------------------------------------------------------

function fractionPair(rng: Rng, difficulty: Difficulty): [Rational, Rational] {
  return byDifficulty<[Rational, Rational]>(difficulty, {
    easy: () => {
      const q = rng.int(3, 12);
      return [r(rng.int(1, q - 1), q), r(rng.int(1, q - 1), q)];
    },
    medium: () => {
      const q1 = rng.int(2, 6);
      const q2 = q1 * rng.int(2, 4);
      return [properFraction(rng, q1, q1), properFraction(rng, q2, q2)];
    },
    hard: () =>
      sample(
        rng,
        (x) => [properFraction(x, 2, 9), properFraction(x, 2, 9)],
        ([a, b]) => a.den !== b.den && a.den % b.den !== 0 && b.den % a.den !== 0,
      ),
  });
}

export const k6FractionAddSub = generator('k6-fraction-add-sub', (context) => {
  const { difficulty, rng } = context;
  const op = pickOperation(context, ['add', 'sub']);
  const [a, b] = sample(
    rng,
    () => {
      const [x, y] = fractionPair(rng, difficulty);
      return (op === 'sub' && x.compare(y) < 0 ? [y, x] : [x, y]) as [Rational, Rational];
    },
    ([x, y]) => !x.equals(y) && (difficulty !== 'easy' || x.den === y.den),
  );
  const result = op === 'add' ? a.add(b) : a.sub(b);
  const sign = op === 'add' ? '+' : '-';
  const combine = (x: number, y: number) => (op === 'add' ? x + y : x - y);
  const common = lcm(a.den, b.den);
  const [na, nb] = [a.num * (common / a.den), b.num * (common / b.den)];
  const raw = r(combine(na, nb), common);

  const sameDen = a.den === b.den;
  return valueTask({
    prompt: tex(`${fracText(a)} ${sign} ${fracText(b)} = \\;?`),
    answer: result,
    distractors: [
      r(Math.abs(combine(a.num, b.num)), a.den + b.den), // Zähler plus Zähler, Nenner plus Nenner
      r(Math.abs(combine(a.num, b.num)), Math.max(a.den, b.den)), // nicht erweitert
      r(Math.abs(combine(na, nb)), 2 * common), // richtig erweitert, aber Nenner addiert
      op === 'add' ? a.sub(b).abs() : a.add(b), // falsche Rechenart
    ].filter((d) => d.sign !== 0),
    format: texFraction,
    explanation: sameDen
      ? [
          plain('Gleiche Nenner: Zähler rechnen, Nenner bleibt.'),
          tex(`\\frac{${a.num} ${sign} ${b.num}}{${a.den}} = ${frac(combine(a.num, b.num), a.den)}${raw.den !== a.den ? ` = ${fracText(result)}` : ''}`),
        ]
      : [
          plain(`Gemeinsamer Nenner: ${common}`),
          tex(`${fracText(a)} ${sign} ${fracText(b)} = ${frac(na, common)} ${sign} ${frac(nb, common)} = ${frac(combine(na, nb), common)}${raw.den !== common ? ` = ${fracText(result)}` : ''}`),
        ],
  });
});

// ---- Brüche multiplizieren und dividieren -----------------------------------------------------

export const k6FractionMulDiv = generator('k6-fraction-mul-div', (context) => {
  const { difficulty, rng } = context;
  const op = pickOperation(context, ['mul', 'div']);
  // mittel: kleine Nenner · schwer: größere Zahlen, bei denen man vorher kürzen kann
  const [a, b] = byDifficulty<[Rational, Rational]>(difficulty, {
    easy: () => [properFraction(rng, 2, 9), r(rng.int(2, 6))],
    medium: () => [properFraction(rng, 2, 6), properFraction(rng, 2, 6)],
    hard: () =>
      sample(
        rng,
        (x) => [properFraction(x, 4, 12), properFraction(x, 4, 12)],
        ([a, b]) => (op === 'mul' ? gcd(a.num, b.den) > 1 || gcd(b.num, a.den) > 1 : gcd(a.num, b.num) > 1 || gcd(a.den, b.den) > 1),
      ),
  });
  const opTex = op === 'mul' ? '\\cdot' : ':';
  const result = op === 'mul' ? a.mul(b) : a.div(b);

  const distractors: Rational[] =
    op === 'mul'
      ? [
          r(a.num * b.num, a.den * b.den * (b.isInteger() ? b.num : 1)), // Zähler und Nenner malgenommen
          r(a.num + b.num, a.den + b.den), // addiert
          r(a.num * b.den, a.den * b.num), // über Kreuz
          r(a.num * b.num, a.den + b.den),
        ]
      : [
          a.mul(b), // ohne Kehrwert
          b.div(a), // falsch herum
          r(a.num * b.num, a.den), // Zähler malgenommen
          r(a.den * b.num, a.num * b.den), // Kehrwert vom falschen Bruch
        ];

  const bText = fracText(b);
  const crossCancel = difficulty === 'hard' ? [plain('Tipp: Vor dem Malnehmen über Kreuz kürzen.')] : [];
  const steps =
    op === 'mul'
      ? [
          ...crossCancel,tex(`${fracText(a)} \\cdot ${bText} = \\frac{${a.num} \\cdot ${b.num}}{${b.isInteger() ? a.den : `${a.den} \\cdot ${b.den}`}} = ${fracText(result)}`)]
      : [
          plain('Mit dem Kehrwert malnehmen.'),
          ...crossCancel,
          tex(`${fracText(a)} : ${bText} = ${fracText(a)} \\cdot ${frac(b.den, b.num)} = ${fracText(result)}`),
        ];
  return valueTask({
    prompt: tex(`${fracText(a)} ${opTex} ${bText} = \\;?`),
    answer: result,
    distractors,
    format: texFraction,
    explanation: steps,
  });
});

// ---- ggT und kgV ----------------------------------------------------------------------------

export const k6GcdLcm = generator('k6-gcd-lcm', ({ difficulty, rng }) => {
  const max = byDifficulty(difficulty, { easy: () => 30, medium: () => 60, hard: () => 120 });
  const wantGcd = rng.chance(0.5);
  const [a, b] = sample(
    rng,
    (x) => [x.int(4, max), x.int(4, max)],
    ([a, b]) => a !== b && gcd(a, b) > 1 && gcd(a, b) < Math.min(a, b) && lcm(a, b) <= (difficulty === 'hard' ? 400 : 200),
  );
  const g = gcd(a, b);
  const l = lcm(a, b);
  if (wantGcd) {
    const common = divisors(g).filter((d) => d < g);
    return valueTask({
      prompt: plain(`ggT(${a}, ${b}) = ?`),
      answer: g,
      // kleinerer gemeinsamer Teiler, kgV verwechselt, kleinere Zahl
      distractors: [...common.filter((d) => d > 1), l, Math.min(a, b)],
      explanation: lines(
        `Teiler von ${a}: ${divisors(a).join(', ')}`,
        `Teiler von ${b}: ${divisors(b).join(', ')}`,
        `Der größte gemeinsame Teiler ist ${g}.`,
      ),
    });
  }
  const multiples = (n: number) => Array.from({ length: Math.min(8, l / n) }, (_, i) => formatInteger(n * (i + 1))).join(', ');
  return valueTask({
    prompt: plain(`kgV(${a}, ${b}) = ?`),
    answer: l,
    // Produkt statt kgV, ggT verwechselt, ein gemeinsames Vielfaches zu viel
    distractors: [a * b, g, 2 * l, Math.max(a, b)],
    explanation: lines(`Vielfache von ${a}: ${multiples(a)} …`, `Vielfache von ${b}: ${multiples(b)} …`, `Das kleinste gemeinsame Vielfache ist ${formatInteger(l)}.`),
  });
});

// ---- Dezimalzahlen ---------------------------------------------------------------------------

function randomDecimal(rng: Rng, places: number, maxInt: number): Rational {
  return sample(rng, (x) => Rational.decimal(x.int(1, maxInt * 10 ** places), places), (v) => v.decimalPlaces() === places);
}

/** Fehler „Komma nicht untereinander“: 3,7 + 2,45 wie 37 + 245 gerechnet → 2,82. */
function misaligned(a: Rational, b: Rational, op: 'add' | 'sub'): Rational {
  const pa = a.decimalPlaces() ?? 0;
  const pb = b.decimalPlaces() ?? 0;
  const ia = a.mul(10 ** pa).num;
  const ib = b.mul(10 ** pb).num;
  return Rational.decimal(op === 'add' ? ia + ib : ia - ib, Math.max(pa, pb));
}

export const k6DecimalAddSub = generator('k6-decimal-add-sub', (context) => {
  const { difficulty, rng } = context;
  const op = pickOperation(context, ['add', 'sub']);
  const [pa, pb] = byDifficulty(difficulty, {
    easy: () => [1, 1],
    medium: () => rng.pick([[1, 2], [2, 1], [2, 2]]),
    hard: () => rng.pick([[0, 2], [1, 3], [3, 2], [2, 3]]),
  });
  const [a, b] = sample(
    rng,
    (x) => [randomDecimal(x, pa, 20), randomDecimal(x, pb, 20)],
    ([a, b]) => op === 'add' || a.compare(b) > 0,
  );
  const result = op === 'add' ? a.add(b) : a.sub(b);
  const places = Math.max(pa, pb);
  const unit = Rational.decimal(1, Math.max(1, places));
  const sym = op === 'add' ? PLUS : MINUS;
  const pad = (v: Rational) => {
    const text = formatDecimal(v);
    const has = v.decimalPlaces() ?? 0;
    return has < places ? `${text}${has === 0 ? ',' : ''}${'0'.repeat(places - has)}` : text;
  };
  return valueTask({
    prompt: plain(`${formatDecimal(a)} ${sym} ${formatDecimal(b)} = ?`),
    answer: result,
    // Komma nicht untereinander, um eine Stelle verrechnet
    distractors: [misaligned(a, b, op), result.add(unit), result.sub(unit), result.add(1), result.sub(1)],
    format: decimal,
    explanation: lines('Komma unter Komma schreiben, fehlende Stellen mit 0 auffüllen.', `${pad(a)} ${sym} ${pad(b)} = ${pad(result)}`),
  });
});

export const k6DecimalMulDiv = generator('k6-decimal-mul-div', (context) => {
  const { difficulty, rng } = context;
  const op = pickOperation(context, ['mul', 'div']);

  const [a, b, result] = byDifficulty<[Rational, Rational, Rational]>(difficulty, {
    // mal/geteilt durch 10, 100, 1000
    easy: () => {
      const a = randomDecimal(rng, rng.int(1, 2), 50);
      const b = r(rng.pick([10, 100, 1000]));
      return op === 'mul' ? [a, b, a.mul(b)] : [a, b, a.div(b)];
    },
    // Dezimalzahl mal/geteilt durch ganze Zahl
    medium: () => {
      const n = r(rng.int(2, 9));
      const x = randomDecimal(rng, rng.int(1, 2), 12);
      return op === 'mul' ? [x, n, x.mul(n)] : [x.mul(n), n, x];
    },
    // Dezimalzahl mal/geteilt durch Dezimalzahl
    hard: () => {
      const x = randomDecimal(rng, 1, 9);
      const y = randomDecimal(rng, 1, 3);
      return op === 'mul' ? [x, y, x.mul(y)] : [x.mul(y), y, x];
    },
  });
  const sym = op === 'mul' ? TIMES : ':';
  const placesA = a.decimalPlaces() ?? 0;
  const placesB = b.decimalPlaces() ?? 0;
  const explanation =
    op === 'mul'
      ? lines(
          `Ohne Komma: ${formatInteger(a.mul(10 ** placesA).num)} ${TIMES} ${formatInteger(b.mul(10 ** placesB).num)} = ${formatInteger(result.mul(10 ** (placesA + placesB)).num)}`,
          `${placesA + placesB} Nachkommastelle${placesA + placesB === 1 ? '' : 'n'} → ${formatDecimal(result)}`,
        )
      : placesB > 0
        ? lines(
            `Komma bei beiden um ${placesB} Stelle${placesB > 1 ? 'n' : ''} nach rechts: ${formatDecimal(a.mul(10 ** placesB))} : ${formatDecimal(b.mul(10 ** placesB))}`,
            `= ${formatDecimal(result)}`,
          )
        : lines(`${formatDecimal(a)} : ${formatDecimal(b)} = ${formatDecimal(result)}`, `Probe: ${formatDecimal(result)} ${TIMES} ${formatDecimal(b)} = ${formatDecimal(a)}`);
  return valueTask({
    prompt: plain(`${formatDecimal(a)} ${sym} ${formatDecimal(b)} = ?`),
    answer: result,
    // Komma an der falschen Stelle, andere Rechenart
    distractors: [
      result.mul(10),
      result.div(10),
      result.mul(100),
      ...(difficulty === 'easy' ? [] : [op === 'mul' ? a.add(b) : a.sub(b).abs()]),
    ],
    format: decimal,
    explanation,
  });
});

// ---- Bruch – Dezimalzahl – Prozent -------------------------------------------------------------

const NICE_DENOMINATORS = [2, 4, 5, 8, 10, 20, 25, 50];
const percent = quantityFormat('%');

export const k6Convert = generator('k6-convert', ({ difficulty, rng }) => {
  const den = rng.pick(difficulty === 'hard' ? NICE_DENOMINATORS : NICE_DENOMINATORS.filter((d) => d !== 8));
  const value = sample(rng, (x) => r(x.int(1, den - 1), den), (v) => v.den === den || difficulty !== 'easy');
  const asPercent = value.mul(100);
  const digitsGlued = Rational.decimal(Number(`${value.num}${value.den}`), String(`${value.num}${value.den}`).length); // 3/4 → 0,34

  return byDifficulty<GeneratedTask>(difficulty, {
    // 3/4 = 0,75
    easy: () =>
      valueTask({
        instruction: 'Schreibe als Dezimalzahl.',
        prompt: tex(fracText(value)),
        answer: value,
        distractors: [digitsGlued, value.mul(10), r(value.num, 10), value.add(Rational.decimal(1, 1))],
        format: decimal,
        explanation: [tex(`${fracText(value)} = ${frac(value.num * (100 / value.den), 100)} = ${formatDecimal(value, 'tex')}`)],
      }),
    // 0,35 ↔ 35 %
    medium: () =>
      rng.chance(0.5)
        ? valueTask({
            instruction: 'Schreibe in Prozent.',
            prompt: plain(formatDecimal(value)),
            answer: asPercent,
            distractors: [value, asPercent.div(10), asPercent.mul(10)],
            format: percent,
            explanation: lines(`${formatDecimal(value)} = ${formatDecimal(asPercent)} Hundertstel = ${formatDecimal(asPercent)} %`),
          })
        : valueTask({
            instruction: 'Schreibe als Dezimalzahl.',
            prompt: plain(`${formatDecimal(asPercent)} %`),
            answer: value,
            distractors: [asPercent, value.div(10), value.mul(10)],
            format: decimal,
            explanation: lines(`${formatDecimal(asPercent)} % = ${formatDecimal(asPercent)} : 100 = ${formatDecimal(value)}`),
          }),
    // 3/8 = 37,5 %  bzw.  35 % = 7/20
    hard: () =>
      rng.chance(0.5)
        ? valueTask({
            instruction: 'Schreibe in Prozent.',
            prompt: tex(fracText(value)),
            answer: asPercent,
            distractors: [r(Math.round(asPercent.toNumber())), asPercent.div(10), value, r(value.num * 10)],
            format: percent,
            explanation: [tex(`${fracText(value)} = ${value.num} : ${value.den} = ${formatDecimal(value, 'tex')} = ${formatDecimal(asPercent, 'tex')}\\,\\%`)],
          })
        : valueTask({
            instruction: 'Schreibe als gekürzten Bruch.',
            prompt: plain(`${formatDecimal(asPercent)} %`),
            answer: value,
            distractors: [asPercent.div(10), r(1, Math.max(2, asPercent.num)), value.add(r(1, value.den))],
            format: texFraction,
            explanation: [tex(`${formatDecimal(asPercent, 'tex')}\\,\\% = ${frac(asPercent.num, 100 * asPercent.den)} = ${fracText(value)}`)],
          }),
  });
});

// ---- Quader: Volumen und Oberfläche ---------------------------------------------------------

export const k6Cuboid = generator('k6-cuboid', ({ difficulty, rng }) => {
  if (difficulty === 'hard') {
    // Aquarium in Litern
    const [a, b, c] = [rng.int(3, 10) * 10, rng.int(2, 6) * 10, rng.int(2, 6) * 10];
    const cm3 = a * b * c;
    const liters = cm3 / 1000;
    return valueTask({
      instruction: 'Wie viele Liter passen hinein?',
      prompt: plain(`Aquarium: ${a} cm × ${b} cm × ${c} cm`),
      answer: liters,
      // nicht umgerechnet, falscher Umrechnungsfaktor
      distractors: [cm3, cm3 / 100, cm3 / 10_000, liters * 10],
      format: quantityFormat('l'),
      explanation: lines(`V = ${a} ${TIMES} ${b} ${TIMES} ${c} = ${formatInteger(cm3)} cm³`, '1 l = 1 dm³ = 1 000 cm³', `${formatInteger(cm3)} cm³ = ${formatInteger(liters)} l`),
    });
  }
  const unit = rng.pick(['cm', 'm', 'dm']);
  const cube = rng.chance(0.25);
  const a = rng.int(2, 12);
  const [b, c] = cube ? [a, a] : [rng.int(2, 12), rng.int(2, 12)];
  const volume = a * b * c;
  const surface = 2 * (a * b + a * c + b * c);
  const shape = cube ? `Würfel: a = ${a} ${unit}` : `Quader: a = ${a} ${unit}, b = ${b} ${unit}, c = ${c} ${unit}`;

  if (difficulty === 'easy') {
    const task = valueTask({
      instruction: 'Berechne das Volumen.',
      prompt: plain(shape),
      answer: volume,
      distractors: [a + b + c, a * b, surface],
      format: quantityFormat(`${unit}³`),
      explanation: lines(`V = a ${TIMES} b ${TIMES} c = ${a} ${TIMES} ${b} ${TIMES} ${c} = ${formatInteger(volume)} ${unit}³`),
    });
    return { ...task, distractors: [...task.distractors, quantityFormat(`${unit}²`)(r(volume))] };
  }
  return valueTask({
    instruction: 'Berechne die Oberfläche.',
    prompt: plain(shape),
    answer: surface,
    // nicht verdoppelt, Volumen verwechselt, nur eine Fläche
    distractors: [surface / 2, volume, a * b * 6, surface + 2 * a * b],
    format: quantityFormat(`${unit}²`),
    explanation: lines(
      `O = 2 ${TIMES} (a ${TIMES} b + a ${TIMES} c + b ${TIMES} c)`,
      `= 2 ${TIMES} (${a * b} + ${a * c} + ${b * c}) = ${formatInteger(surface)} ${unit}²`,
    ),
  });
});

export const GRADE_6_GENERATORS: readonly TaskGenerator[] = [
  k6FractionSimplify,
  k6FractionAddSub,
  k6FractionMulDiv,
  k6GcdLcm,
  k6DecimalAddSub,
  k6DecimalMulDiv,
  k6Convert,
  k6Cuboid,
];
