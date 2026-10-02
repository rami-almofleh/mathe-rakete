import { BallColor, BarChartFigure, Figure, GridFigure, NumberLineFigure, plain, SolidShape, tex, UrnFigure } from '../../models';
import { formatInteger } from '../../math/format';
import { gcd } from '../../math/number-theory';
import { Polynomial } from '../../math/polynomial';
import { Rational } from '../../math/rational';
import { Rng } from '../../math/rng';
import { textAnswer } from '../answers';
import { Answer, GeneratedTask, TaskGenerator } from '../generator';
import { polyAnswer, signed } from '../middle/helpers';
import { expr, integerTask, PLUS, TIMES } from '../primary/helpers';
import { byDifficulty, degreeFormat, generator, lines, quantityFormat, sample } from '../task-helpers';

/** Aufgabe mit Bild: Bilddaten + Frage + Antworten */
function figureTask(figure: Figure, question: string, task: Omit<GeneratedTask, 'prompt'>, instruction?: string): GeneratedTask {
  return { ...task, prompt: { instruction, math: plain(question), figure } };
}

// ---- Uhr ablesen (Kl. 2) -------------------------------------------------------------------

const wrapHour = (h: number) => ((((h - 1) % 12) + 12) % 12) + 1;

function timeAnswer(h: number, m: number): Answer {
  const hh = wrapHour(h);
  return textAnswer(plain(`${hh}:${String(m).padStart(2, '0')} Uhr`), `time:${hh}:${m}`);
}

/** Winkelabstand zwischen Stunden- und Minutenzeiger in Grad */
function handGap(h: number, m: number): number {
  const diff = Math.abs(((h % 12) + m / 60) * 30 - m * 6) % 360;
  return Math.min(diff, 360 - diff);
}

export const k2Clock = generator('k2-clock', ({ difficulty, rng }) => {
  // Zeiger, die fast übereinander liegen, sind für Kinder kaum lesbar → vermeiden
  const [h, m] = sample(
    rng,
    (r) => [
      r.int(1, 12),
      byDifficulty(difficulty, {
        easy: () => 0,
        medium: () => r.pick([15, 30, 45]),
        hard: () => r.pick([5, 10, 20, 25, 35, 40, 50, 55]),
      }),
    ],
    ([h, m]) => m === 0 || handGap(h, m) >= 25,
  );
  const pointsAt = m / 5 || 12;
  const swapped = timeAnswer(pointsAt, ((h % 12) * 5) % 60); // Zeiger verwechselt
  const distractors =
    m === 0
      ? [swapped, timeAnswer(h + 1, 0), timeAnswer(h - 1, 0)]
      : [
          swapped,
          timeAnswer(m >= 30 ? h + 1 : h - 1, m), // Stundenzeiger schon beim nächsten / noch beim vorigen gelesen
          ...(m % 15 === 0 ? [timeAnswer(h, 60 - m)] : [timeAnswer(h, m / 5)]), // Viertel nach ↔ Viertel vor · Zahl statt Minuten gelesen
          timeAnswer(h, (m + 30) % 60),
        ];
  const minuteText = m === 0 ? 'Der lange Zeiger zeigt auf die 12 → volle Stunde.' : `Der lange Zeiger zeigt auf die ${pointsAt} → ${pointsAt} · 5 = ${m} Minuten.`;
  const hourText =
    m === 0
      ? `Der kurze Zeiger zeigt auf die ${h} → ${h} Uhr.`
      : `Der kurze Zeiger steht zwischen ${h} und ${wrapHour(h + 1)} → noch ${h} Uhr.`;
  return figureTask(
    { kind: 'clock', hours: h, minutes: m },
    'Wie spät ist es?',
    {
      answer: timeAnswer(h, m),
      distractors,
      fallback: (r) => timeAnswer(h + r.pick([-2, 2, 3]), m),
      explanation: lines(hourText, minuteText),
    },
  );
});

// ---- Fläche und Umfang im Gitter (Kl. 3) --------------------------------------------------------

type Cell = readonly [number, number];
const key = ([c, r]: Cell) => `${c},${r}`;
const NEIGHBORS: readonly Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function rectangle(x: number, y: number, w: number, h: number): Cell[] {
  return Array.from({ length: w * h }, (_, i) => [x + (i % w), y + Math.floor(i / w)] as const);
}

/** Zusammenhängende Figur ohne Löcher aus `size` Kästchen */
function polyomino(rng: Rng, size: number): Cell[] {
  return sample(
    rng,
    () => {
      const cells = new Map<string, Cell>([['0,0', [0, 0]]]);
      while (cells.size < size) {
        const [c, r] = rng.pick([...cells.values()]);
        const [dc, dr] = rng.pick(NEIGHBORS);
        const next: Cell = [c + dc, r + dr];
        cells.set(key(next), next);
      }
      return [...cells.values()];
    },
    (cells) => !hasHole(cells) && width(cells) <= 7 && height(cells) <= 5,
  );
}

const width = (cells: Cell[]) => Math.max(...cells.map((c) => c[0])) - Math.min(...cells.map((c) => c[0])) + 1;
const height = (cells: Cell[]) => Math.max(...cells.map((c) => c[1])) - Math.min(...cells.map((c) => c[1])) + 1;

function hasHole(cells: Cell[]): boolean {
  const filled = new Set(cells.map(key));
  const [minC, maxC] = [Math.min(...cells.map((c) => c[0])) - 1, Math.max(...cells.map((c) => c[0])) + 1];
  const [minR, maxR] = [Math.min(...cells.map((c) => c[1])) - 1, Math.max(...cells.map((c) => c[1])) + 1];
  const seen = new Set<string>();
  const stack: Cell[] = [[minC, minR]];
  while (stack.length) {
    const cell = stack.pop()!;
    const k = key(cell);
    if (seen.has(k) || filled.has(k) || cell[0] < minC || cell[0] > maxC || cell[1] < minR || cell[1] > maxR) continue;
    seen.add(k);
    NEIGHBORS.forEach(([dc, dr]) => stack.push([cell[0] + dc, cell[1] + dr]));
  }
  const boxCells = (maxC - minC + 1) * (maxR - minR + 1);
  return seen.size + filled.size < boxCells;
}

/** Umfang in Kästchenseiten */
function perimeter(cells: Cell[]): number {
  const filled = new Set(cells.map(key));
  return cells.reduce((sum, [c, r]) => sum + NEIGHBORS.filter(([dc, dr]) => !filled.has(key([c + dc, r + dr]))).length, 0);
}

/** Figur mit einem Kästchen Rand in ein Gitter setzen */
function toGrid(cells: Cell[]): GridFigure {
  const minC = Math.min(...cells.map((c) => c[0]));
  const minR = Math.min(...cells.map((c) => c[1]));
  const shifted = cells.map(([c, r]) => [c - minC + 1, r - minR + 1] as const);
  return { kind: 'grid', columns: width(cells) + 2, rows: height(cells) + 2, cells: shifted };
}

export const k3GridArea = generator('k3-grid-area', ({ difficulty, rng }) => {
  const cells = byDifficulty<Cell[]>(difficulty, {
    easy: () => rectangle(0, 0, rng.int(2, 6), rng.int(2, 4)),
    // L-Form: Rechteck ohne Ecke
    medium: () => {
      const [w, h] = [rng.int(3, 6), rng.int(3, 4)];
      const [cw, ch] = [rng.int(1, w - 1), rng.int(1, h - 1)];
      const cut = new Set(rectangle(w - cw, 0, cw, ch).map(key));
      return rectangle(0, 0, w, h).filter((c) => !cut.has(key(c)));
    },
    hard: () => polyomino(rng, rng.int(7, 14)),
  });
  const area = cells.length;
  const around = perimeter(cells);
  const boxArea = width(cells) * height(cells);
  const boxPerimeter = 2 * (width(cells) + height(cells));
  const figure = toGrid(cells);

  if (rng.chance(0.5)) {
    const format = quantityFormat('cm²');
    return figureTask(
      figure,
      'Wie groß ist der Flächeninhalt?',
      {
        answer: format(Rational.of(area)),
        // Umfang statt Fläche, ganzes Rechteck gezählt, verzählt
        distractors: [around, boxArea, area + 1, area - 1, area + 2].filter((v) => v !== area && v > 0).map((v) => format(Rational.of(v))),
        explanation: lines('Zähle die gefärbten Kästchen.', `${area} Kästchen → ${area} cm²`),
      },
      '1 Kästchen = 1 cm²',
    );
  }
  const format = quantityFormat('cm');
  return figureTask(
    figure,
    'Wie lang ist der Umfang?',
    {
      answer: format(Rational.of(around)),
      // Fläche statt Umfang, nur das umgebende Rechteck, verzählt
      distractors: [area, boxPerimeter, around + 2, around - 2].filter((v) => v !== around && v > 0).map((v) => format(Rational.of(v))),
      explanation: lines('Fahre einmal außen um die Figur und zähle die Kästchenseiten.', `${around} Seiten → ${around} cm`),
    },
    '1 Kästchenseite = 1 cm',
  );
});

// ---- Winkel (Kl. 5) -----------------------------------------------------------------------------

const ANGLE_TYPES = [
  { name: 'spitzer Winkel', test: (a: number) => a > 0 && a < 90, rule: 'kleiner als 90°' },
  { name: 'rechter Winkel', test: (a: number) => a === 90, rule: 'genau 90°' },
  { name: 'stumpfer Winkel', test: (a: number) => a > 90 && a < 180, rule: 'zwischen 90° und 180°' },
  { name: 'gestreckter Winkel', test: (a: number) => a === 180, rule: 'genau 180°' },
  { name: 'überstumpfer Winkel', test: (a: number) => a > 180 && a < 360, rule: 'zwischen 180° und 360°' },
] as const;

/** Zwei Schätz-Ablenker, die deutlich (≥ 25°) von der Lösung und voneinander abweichen */
function estimateDistractors(rng: Rng, alpha: number, candidates: number[]): number[] {
  const chosen: number[] = [];
  for (const c of candidates) {
    if (c > 5 && c < 355 && [alpha, ...chosen].every((x) => Math.abs(x - c) >= 25)) chosen.push(c);
    if (chosen.length === 2) break;
  }
  for (let i = 0; chosen.length < 2 && i < 50; i++) {
    const c = alpha + rng.pick([-1, 1]) * rng.int(3, 8) * 10;
    if (c > 5 && c < 355 && [alpha, ...chosen].every((x) => Math.abs(x - c) >= 25)) chosen.push(c);
  }
  return chosen;
}

export const k5Angles = generator('k5-angles', ({ difficulty, rng }) => {
  const deg = degreeFormat();
  if (difficulty === 'easy') {
    const type = rng.pick(ANGLE_TYPES);
    const alpha = sample(rng, (r) => r.int(2, 34) * 10, type.test);
    const index = ANGLE_TYPES.indexOf(type);
    const neighbors = ANGLE_TYPES.filter((_, i) => Math.abs(i - index) === 1 || Math.abs(i - index) === 2);
    const toAnswer = (name: string) => textAnswer(plain(name), `angle:${name}`);
    return figureTask(
      { kind: 'angle', degrees: alpha, rotation: 0 },
      'Welche Art von Winkel ist das?',
      {
        answer: toAnswer(type.name),
        distractors: rng.shuffle(neighbors).slice(0, 3).map((t) => toAnswer(t.name)),
        explanation: lines(`Ein ${type.name} ist ${type.rule}.`, `Hier: ${alpha}°`),
      },
    );
  }
  const hard = difficulty === 'hard';
  const alpha = hard ? rng.int(3, 33) * 10 : rng.int(2, 17) * 10;
  const rotation = hard ? rng.int(0, 11) * 30 : 0;
  // Winkelmesser falsch herum abgelesen (180° − α), Innen- und Außenwinkel verwechselt (360° − α)
  const wrong = estimateDistractors(rng, alpha, rng.shuffle([180 - alpha, 360 - alpha, alpha + 40, alpha - 40, alpha + 60]));
  return figureTask(
    { kind: 'angle', degrees: alpha, rotation },
    'Wie groß ist der Winkel ungefähr?',
    {
      answer: deg(Rational.of(alpha)),
      distractors: wrong.map((w) => deg(Rational.of(w))),
      explanation: lines(
        'Vergleiche mit einem rechten Winkel (90°) und einem gestreckten Winkel (180°).',
        alpha < 90 ? 'Der Winkel ist kleiner als ein rechter Winkel.' : alpha < 180 ? 'Der Winkel liegt zwischen 90° und 180°.' : 'Der Winkel ist größer als ein gestreckter Winkel.',
        `Er misst ${alpha}°.`,
      ),
    },
  );
});

// ---- Brüche am Bild (Kl. 5) -------------------------------------------------------------------------

/** Nur echte Brüche als Ablenker – „2/1“ oder „4/4“ verwirren bei Anteilen eines Ganzen */
const proper = (a: Answer) => {
  const m = /frac\{(\d+)\}\{(\d+)\}/.exec(a.display.value);
  return !!m && Number(m[1]) < Number(m[2]);
};

/** Bruch so angezeigt, wie er im Bild steht (3/6 bleibt 3/6); gleichwertige Brüche gelten als gleich. */
function pictureFraction(num: number, den: number): Answer {
  return textAnswer(tex(`\\frac{${num}}{${den}}`), `v:${Rational.of(num, den).key()}`);
}

/** Schreibweise zählt (für „gekürzt angeben“) */
function exactFraction(num: number, den: number): Answer {
  return textAnswer(tex(`\\frac{${num}}{${den}}`), `f:${num}/${den}`);
}

export const k5FractionPicture = generator('k5-fraction-picture', ({ difficulty, rng }) => {
  const shape = rng.pick(['circle', 'bar'] as const);
  const kind = difficulty === 'hard' ? rng.pick(['unfilled', 'reduced'] as const) : 'filled';
  // „gekürzt“ braucht eine Teilezahl, die sich kürzen lässt
  const n = kind === 'reduced' ? rng.pick([4, 6, 8, 9, 10, 12]) : difficulty === 'easy' ? rng.int(2, 8) : rng.int(3, 12);
  const k = kind === 'reduced' ? sample(rng, (r) => r.int(2, n - 1), (k) => gcd(k, n) > 1) : rng.int(1, n - 1);
  const filled = difficulty === 'easy' ? Array.from({ length: k }, (_, i) => i) : rng.shuffle(Array.from({ length: n }, (_, i) => i)).slice(0, k);
  const figure: Figure = { kind: 'fraction', shape, parts: n, filled };
  const intro = `Das Ganze hat ${n} gleich große Teile, ${k} davon sind gefärbt.`;

  if (kind === 'reduced') {
    const g = gcd(k, n);
    return figureTask(figure, 'Welcher Anteil ist gefärbt? (gekürzt)', {
      answer: exactFraction(k / g, n / g),
      // ungekürzt, nicht gefärbter Anteil, gefärbt : ungefärbt
      distractors: [exactFraction(k, n), exactFraction((n - k) / gcd(n - k, n), n / gcd(n - k, n)), exactFraction(k, n - k), exactFraction(k / g, n)]
        .filter((a) => a.key !== `f:${k / g}/${n / g}`)
        .filter(proper),
      explanation: [plain(intro), tex(`\\frac{${k}}{${n}} = \\frac{${k} : ${g}}{${n} : ${g}} = \\frac{${k / g}}{${n / g}}`)],
    });
  }
  if (kind === 'unfilled') {
    return figureTask(figure, 'Welcher Anteil ist NICHT gefärbt?', {
      answer: pictureFraction(n - k, n),
      distractors: [pictureFraction(k, n), pictureFraction(n - k, k), pictureFraction(n - k, n + 1), pictureFraction(n - k + 1, n)].filter(proper),
      fallback: (r) => pictureFraction(n - k, n + r.int(2, 3)),
      explanation: [plain(intro), plain(`Nicht gefärbt: ${n} − ${k} = ${n - k} Teile`), tex(`\\frac{${n - k}}{${n}}`)],
    });
  }
  return figureTask(figure, 'Welcher Anteil ist gefärbt?', {
    answer: pictureFraction(k, n),
    // ungefärbter Anteil, gefärbt : ungefärbt, Teile falsch gezählt
    distractors: [pictureFraction(n - k, n), pictureFraction(k, n - k), pictureFraction(k, n + 1), pictureFraction(k + 1, n)].filter(proper),
    fallback: (r) => pictureFraction(k, n + r.int(2, 3)),
    explanation: [plain(intro), tex(`\\frac{${k}}{${n}}`)],
  });
});

// ---- Geraden am Graphen ablesen (Kl. 8) --------------------------------------------------------------

export const k8GraphReading = generator('k8-graph-reading', ({ difficulty, rng }) => {
  const [rise, run] = byDifficulty<[number, number]>(difficulty, {
    easy: () => [rng.int(1, 3), 1],
    medium: () => (rng.chance(0.3) ? [rng.sign(), 2] : [signed(rng, 1, 3), 1]),
    hard: () => sample(rng, (r) => [signed(r, 1, 3), r.int(2, 3)], ([p, q]) => gcd(Math.abs(p), q) === 1),
  });
  const b = sample(rng, (r) => r.int(-4, 4), (b) => b !== 0 || difficulty !== 'easy');
  const m = Rational.of(rise, run);
  const f = linear(m, b);
  const wrong = [
    ...(b !== 0 && !m.equals(b) ? [linear(Rational.of(b), m)] : []), // m und b vertauscht
    linear(m.neg(), b), // Steigung mit falschem Vorzeichen
    b !== 0 ? linear(m, -b) : linear(m, 1), // Achsenabschnitt falsch
    ...(Math.abs(rise) !== run ? [linear(Rational.of(run, rise), b)] : []), // Steigungsdreieck falsch herum
  ];
  const direction = rise > 0 ? 'nach oben' : 'nach unten';
  return figureTask(
    { kind: 'graph', range: 5, lines: [{ rise, run, b }] },
    'Welche Funktionsgleichung gehört zur Geraden?',
    {
      answer: polyAnswer(f),
      distractors: wrong.map((p) => polyAnswer(p)),
      explanation: [
        plain(`Der Graph schneidet die y-Achse bei ${formatInteger(b)} → b = ${formatInteger(b)}.`),
        plain(`Steigungsdreieck: ${run} nach rechts, ${Math.abs(rise)} ${direction}.`),
        tex(`m = ${rise < 0 ? '-' : ''}\\frac{${Math.abs(rise)}}{${run}}${run === 1 ? ` = ${rise}` : ''} \\;\\Rightarrow\\; f(x) = ${f.format()}`),
      ],
    },
  );
});

/** m·x + b */
function linear(m: Rational, b: Rational | number): Polynomial {
  return Polynomial.of(b, m);
}

/** Ganzzahl-Aufgabe mit Bild */
function integerFigureTask(figure: Figure, task: GeneratedTask): GeneratedTask {
  return { ...task, prompt: { ...task.prompt, figure } };
}

// ---- Achsensymmetrie (Kl. 3–4) ----------------------------------------------------------------------

type Orientation = 'vertical' | 'horizontal';

/**
 * Halbe Figur an der Spiegelachse, gespiegelt – aber `missing` Kästchen der Spiegelseite fehlen noch.
 * Frage: Wie viele Kästchen muss man noch färben? (Kinder vergleichen Kästchen für Kästchen über die Achse.)
 */
function symmetryTask(rng: Rng, size: number, missing: number, orientation: Orientation, maxSide: number): GeneratedTask {
  const half = sample(rng, (r) => polyomino(r, size), (cells) => width(cells) <= maxSide && height(cells) <= maxSide);
  const minC = Math.min(...half.map((c) => c[0]));
  const minR = Math.min(...half.map((c) => c[1]));
  const [w, h] = [width(half), height(half)];
  // eine Reihe Rand; die Figur berührt die Achse
  const placed = half.map(([c, r]): Cell => [c - minC + 1, r - minR + 1]);
  const at = orientation === 'vertical' ? w + 1 : h + 1;
  const mirror = ([c, r]: Cell): Cell => (orientation === 'vertical' ? [2 * at - 1 - c, r] : [c, 2 * at - 1 - r]);
  const mirrored = rng.shuffle(placed.map(mirror)).slice(missing);
  const figure: GridFigure = {
    kind: 'grid',
    columns: orientation === 'vertical' ? 2 * at : w + 2,
    rows: orientation === 'vertical' ? h + 2 : 2 * at,
    cells: [...placed, ...mirrored],
    axis: { orientation, at },
  };
  const [here, there] = orientation === 'vertical' ? ['links', 'rechts'] : ['oben', 'unten'];
  return integerFigureTask(
    figure,
    integerTask({
      instruction: 'Die rote Linie ist die Spiegelachse.',
      prompt: `Wie viele Kästchen musst du ${there} noch färben, damit die Figur symmetrisch ist?`,
      answer: missing,
      // verzählt, alle Kästchen einer Seite gezählt, die schon gefärbten gezählt
      distractors: [missing + 1, missing - 1, size, size - missing, missing + 2],
      explanation: [
        `${here[0].toUpperCase()}${here.slice(1)}: ${size} Kästchen, ${there}: ${size - missing} Kästchen.`,
        `Es fehlen ${expr(size, '−', size - missing, '=', missing)} Kästchen.`,
      ],
    }),
  );
}

export const k3Symmetry = generator('k3-symmetry', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    easy: () => symmetryTask(rng, rng.int(3, 4), 1, 'vertical', 3),
    medium: () => symmetryTask(rng, rng.int(4, 6), 2, 'vertical', 3),
    hard: () => symmetryTask(rng, rng.int(6, 8), rng.int(3, 4), 'vertical', 4),
  }),
);

export const k4Symmetry = generator('k4-symmetry', ({ difficulty, rng }) => {
  const orientation = rng.pick<Orientation>(['vertical', 'horizontal']);
  return byDifficulty(difficulty, {
    easy: () => symmetryTask(rng, rng.int(5, 6), 2, orientation, 4),
    medium: () => symmetryTask(rng, rng.int(6, 8), 3, orientation, 4),
    hard: () => symmetryTask(rng, rng.int(8, 10), rng.int(4, 5), orientation, 4),
  });
});

// ---- Körper (Kl. 3) ------------------------------------------------------------------------------------

const SOLID_NAMES: Readonly<Record<SolidShape, string>> = {
  cube: 'Würfel',
  cuboid: 'Quader',
  pyramid: 'Pyramide',
  prism: 'Prisma',
  cylinder: 'Zylinder',
  cone: 'Kegel',
  sphere: 'Kugel',
};
/** Was Kinder verwechseln */
const LOOKALIKES: Readonly<Record<SolidShape, readonly SolidShape[]>> = {
  cube: ['cuboid', 'pyramid', 'prism'],
  cuboid: ['cube', 'prism', 'cylinder'],
  pyramid: ['cone', 'prism', 'cube'],
  prism: ['pyramid', 'cuboid', 'cylinder'],
  cylinder: ['cone', 'cuboid', 'sphere'],
  cone: ['pyramid', 'cylinder', 'sphere'],
  sphere: ['cylinder', 'cone', 'cube'],
};
/** Ecken, Kanten, Flächen – nur für Körper ohne Rundungen eindeutig */
const COUNTS: Partial<Record<SolidShape, { readonly Ecken: number; readonly Kanten: number; readonly Flächen: number }>> = {
  cube: { Ecken: 8, Kanten: 12, Flächen: 6 },
  cuboid: { Ecken: 8, Kanten: 12, Flächen: 6 },
  pyramid: { Ecken: 5, Kanten: 8, Flächen: 5 },
  prism: { Ecken: 6, Kanten: 9, Flächen: 5 },
};
/** Flächen runder Körper, wie in der Grundschule gezählt (Kreise und gewölbte Fläche) */
const ROUND_FACES: Partial<Record<SolidShape, number>> = { cylinder: 3, cone: 2, sphere: 1 };
const FACE_HINTS: Partial<Record<SolidShape, string>> = {
  cube: '6 gleich große Quadrate',
  cuboid: '6 Rechtecke, je zwei gegenüber gleich',
  pyramid: '1 Quadrat unten und 4 Dreiecke',
  prism: '2 Dreiecke und 3 Rechtecke',
  cylinder: '2 Kreise und 1 gewölbte Fläche',
  cone: '1 Kreis und 1 gewölbte Fläche',
  sphere: 'nur 1 gewölbte Fläche',
};

const nameAnswer = (shape: SolidShape) => textAnswer(plain(SOLID_NAMES[shape]), `solid:${shape}`);

function solidNameTask(rng: Rng, shapes: readonly SolidShape[]): GeneratedTask {
  const shape = rng.pick(shapes);
  return figureTask({ kind: 'solid', shape }, 'Wie heißt dieser Körper?', {
    answer: nameAnswer(shape),
    distractors: LOOKALIKES[shape].map(nameAnswer),
    explanation: lines(`Der Körper hat ${FACE_HINTS[shape]}.`, `Das ist ein${shape === 'pyramid' || shape === 'sphere' ? 'e' : ''} ${SOLID_NAMES[shape]}.`),
  });
}

function solidCountTask(rng: Rng, shapes: readonly SolidShape[]): GeneratedTask {
  const shape = rng.pick(shapes);
  const counts = COUNTS[shape]!;
  const what = rng.pick(['Ecken', 'Kanten', 'Flächen'] as const);
  const answer = counts[what];
  const others = Object.values(counts).filter((v) => v !== answer);
  const article = shape === 'pyramid' ? 'eine' : 'ein';
  return integerFigureTask(
    { kind: 'solid', shape },
    integerTask({
      prompt: `Wie viele ${what} hat ${article} ${SOLID_NAMES[shape]}?`,
      answer,
      // Ecken/Kanten/Flächen verwechselt, nur die sichtbaren gezählt
      distractors: [...others, answer - 1, answer - 2, answer + 1],
      explanation: [
        what === 'Flächen' ? `Flächen: ${FACE_HINTS[shape]}.` : `Zähle auch die gestrichelten ${what === 'Kanten' ? 'Kanten' : 'Ecken'} hinten mit.`,
        `${article === 'eine' ? 'Eine' : 'Ein'} ${SOLID_NAMES[shape]} hat ${answer} ${what}.`,
      ],
    }),
  );
}

function roundFacesTask(rng: Rng): GeneratedTask {
  const shape = rng.pick<SolidShape>(['cylinder', 'cone', 'sphere']);
  const answer = ROUND_FACES[shape]!;
  return integerFigureTask(
    { kind: 'solid', shape },
    integerTask({
      prompt: `Wie viele Flächen hat ${shape === 'sphere' ? 'eine' : 'ein'} ${SOLID_NAMES[shape]}?`,
      answer,
      distractors: [answer + 1, answer - 1, answer + 2, 0],
      explanation: [`Flächen: ${FACE_HINTS[shape]}.`],
    }),
  );
}

export const k3Solids = generator('k3-solids', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    easy: () => solidNameTask(rng, ['cube', 'cuboid', 'pyramid', 'cylinder', 'cone', 'sphere']),
    medium: () => (rng.chance(0.3) ? solidNameTask(rng, ['cube', 'cuboid', 'pyramid', 'cylinder', 'cone', 'sphere']) : solidCountTask(rng, ['cube', 'cuboid', 'pyramid'])),
    hard: () => {
      const kind = rng.pick(['name', 'count', 'count', 'round'] as const);
      if (kind === 'name') return solidNameTask(rng, ['prism', 'pyramid', 'cone', 'cylinder']);
      if (kind === 'round') return roundFacesTask(rng);
      return solidCountTask(rng, ['pyramid', 'prism', 'cuboid']);
    },
  }),
);

// ---- Wahrscheinlichkeit (Kl. 3–4) ----------------------------------------------------------------------

const BALL_COLORS: readonly BallColor[] = ['rot', 'blau', 'gelb', 'grün'];
type Ball = { readonly color: BallColor; readonly count: number };
const word = (s: string) => textAnswer(plain(s), s);
/** Farbe als Nomen: „Rot und Blau“ */
const noun = (c: string) => c[0].toUpperCase() + c.slice(1);

/** Sicher, möglich oder unmöglich? */
function certaintyTask(rng: Rng): GeneratedTask {
  const [c1, c2, absent] = rng.shuffle([...BALL_COLORS]);
  const balls: Ball[] = [{ color: c1, count: rng.int(1, 6) }, { color: c2, count: rng.int(1, 6) }];
  const kind = rng.pick(['sicher', 'möglich', 'unmöglich'] as const);
  const event = kind === 'sicher' ? `${c1} oder ${c2}` : kind === 'möglich' ? rng.pick([c1, c2]) : absent;
  const reason =
    kind === 'sicher'
      ? `Im Beutel sind nur ${c1}e und ${c2}e Kugeln – du ziehst bestimmt eine davon.`
      : kind === 'möglich'
        ? `Es gibt ${event}e Kugeln, aber auch andere – es kann passieren, muss aber nicht.`
        : `Im Beutel ist keine ${absent}e Kugel.`;
  return figureTask({ kind: 'urn', bags: [{ balls }] }, `Du ziehst ohne hinzuschauen eine Kugel. Sie ist ${event}. Das ist …`, {
    answer: word(kind),
    distractors: ['sicher', 'möglich', 'unmöglich'].filter((w) => w !== kind).map(word),
    explanation: lines(reason, `Also: ${kind}.`),
  });
}

/** Welche Farbe ist am wahrscheinlichsten (bzw. am unwahrscheinlichsten)? */
function likelyColorTask(rng: Rng, colors: 2 | 3, allowEqual: boolean): GeneratedTask {
  const chosen = rng.shuffle([...BALL_COLORS]).slice(0, colors);
  const equal = allowEqual && colors === 2 && rng.chance(0.25);
  const counts = equal
    ? (() => {
        const n = rng.int(2, 6);
        return [n, n];
      })()
    : sample(rng, (r) => chosen.map(() => r.int(1, 8)), (c) => new Set(c).size === c.length);
  const balls: Ball[] = chosen.map((color, i) => ({ color, count: counts[i] }));
  const rarest = colors === 3 && rng.chance(0.4);
  const target = [...balls].sort((a, b) => (rarest ? a.count - b.count : b.count - a.count))[0];
  const question = colors === 2 ? 'Welche Farbe ziehst du wahrscheinlicher?' : rarest ? 'Welche Farbe ziehst du am seltensten?' : 'Welche Farbe ziehst du am wahrscheinlichsten?';
  const answer = equal ? 'gleich wahrscheinlich' : target.color;
  const options = colors === 2 ? [...chosen, 'gleich wahrscheinlich'] : chosen;
  return figureTask({ kind: 'urn', bags: [{ balls }] }, `Du ziehst ohne hinzuschauen eine Kugel. ${question}`, {
    answer: word(answer),
    distractors: options.filter((o) => o !== answer).map(word),
    explanation: lines(
      balls.map((b) => `${b.count} ${b.color}e`).join(', '),
      equal ? 'Von beiden Farben gibt es gleich viele.' : rarest ? `Von ${noun(target.color)} gibt es am wenigsten.` : `Von ${noun(target.color)} gibt es am meisten.`,
    ),
  });
}

/** Wie viele Kugeln dazulegen, damit beide Farben gleich wahrscheinlich sind? */
function equalizeTask(rng: Rng): GeneratedTask {
  const [many, few] = rng.shuffle([...BALL_COLORS]);
  const [a, b] = sample(rng, (r) => [r.int(3, 9), r.int(1, 7)], ([a, b]) => a > b);
  const balls: Ball[] = rng.shuffle([{ color: many, count: a }, { color: few, count: b }]);
  return integerFigureTask(
    { kind: 'urn', bags: [{ balls }] },
    integerTask({
      prompt: `Wie viele ${few}e Kugeln musst du dazulegen, damit ${noun(many)} und ${noun(few)} gleich wahrscheinlich sind?`,
      answer: a - b,
      // so viele wie die andere Farbe, alle zusammen, verzählt
      distractors: [a, a + b, a - b + 1, a - b - 1],
      explanation: [`${a} ${many}e, ${b} ${few}e`, `Gleich viele: ${expr(a, '−', b, '=', a - b)} ${few}e dazu.`],
    }),
  );
}

/** Zwei Beutel: in welchem ist Rot wahrscheinlicher? Gleich viele Kugeln oder gleich viele rote – oder genau im selben Verhältnis. */
function compareBagsTask(rng: Rng): GeneratedTask {
  const other = rng.pick<BallColor>(['blau', 'gelb', 'grün']);
  const kind = rng.pick(['sameTotal', 'sameRed', 'proportional'] as const);
  let [redA, otherA, redB, otherB]: number[] = [];
  if (kind === 'sameTotal') {
    const total = rng.int(6, 10);
    [redA, redB] = sample(rng, (r) => [r.int(1, total - 1), r.int(1, total - 1)], ([x, y]) => x !== y);
    [otherA, otherB] = [total - redA, total - redB];
  } else if (kind === 'sameRed') {
    redA = redB = rng.int(2, 5);
    [otherA, otherB] = sample(rng, (r) => [r.int(1, 8), r.int(1, 8)], ([x, y]) => x !== y);
  } else {
    [redA, otherA] = [rng.int(1, 3), rng.int(1, 4)];
    const k = 2;
    [redB, otherB] = [redA * k, otherA * k];
  }
  const swap = rng.chance(0.5);
  if (swap) [redA, otherA, redB, otherB] = [redB, otherB, redA, otherA];
  const pA = redA / (redA + otherA);
  const pB = redB / (redB + otherB);
  const answer = Math.abs(pA - pB) < 1e-9 ? 'gleich wahrscheinlich' : pA > pB ? 'Beutel A' : 'Beutel B';
  const bag = (label: string, red: number, rest: number) => ({ label, balls: [{ color: 'rot' as const, count: red }, { color: other, count: rest }] });
  const figure: UrnFigure = { kind: 'urn', bags: [bag('Beutel A', redA, otherA), bag('Beutel B', redB, otherB)] };
  const reason =
    kind === 'sameTotal'
      ? 'Beide Beutel haben gleich viele Kugeln – mehr rote heißt wahrscheinlicher.'
      : kind === 'sameRed'
        ? 'In beiden Beuteln sind gleich viele rote – weniger andere Kugeln heißt wahrscheinlicher.'
        : `In Beutel ${redA < redB ? 'B' : 'A'} ist alles doppelt so oft – das Verhältnis bleibt gleich.`;
  return figureTask(figure, 'In welchem Beutel ziehst du wahrscheinlicher eine rote Kugel?', {
    answer: word(answer),
    distractors: ['Beutel A', 'Beutel B', 'gleich wahrscheinlich'].filter((w) => w !== answer).map(word),
    explanation: lines(`A: ${redA} von ${redA + otherA} rot, B: ${redB} von ${redB + otherB} rot`, reason),
  });
}

export const k3Chance = generator('k3-chance', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    easy: () => certaintyTask(rng),
    medium: () => likelyColorTask(rng, 2, true),
    hard: () => likelyColorTask(rng, 3, false),
  }),
);

export const k4Chance = generator('k4-chance', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    easy: () => (rng.chance(0.5) ? likelyColorTask(rng, 3, false) : certaintyTask(rng)),
    medium: () => equalizeTask(rng),
    hard: () => compareBagsTask(rng),
  }),
);

// ---- Zahlenstrahl (Kl. 1–4) ------------------------------------------------------------------------

type Line = Omit<NumberLineFigure, 'kind' | 'marked'>;

/** Pfeil auf einen unbeschrifteten Strich setzen und fragen, welche Zahl er zeigt. */
function numberLineTask(rng: Rng, line: Line, max: number): GeneratedTask {
  const ticks = (line.end - line.start) / line.step;
  const marked = sample(rng, (r) => line.start + line.step * r.int(1, ticks - 1), (v) => v % line.labelEvery !== 0);
  const label = Math.floor(marked / line.labelEvery) * line.labelEvery;
  const count = (marked - label) / line.step;
  // vom näheren beschrifteten Strich aus zählen – geschickter als 8 Striche vorwärts
  const backwards = marked - label > line.labelEvery / 2 && label + line.labelEvery <= line.end;
  const from = backwards ? label + line.labelEvery : label;
  const steps = Math.abs(marked - from) / line.step;
  const strokes = `${steps} ${steps === 1 ? 'Strich' : 'Striche'}`;
  return integerFigureTask(
    { kind: 'numberline', ...line, marked },
    integerTask({
      prompt: 'Welche Zahl zeigt der Pfeil?',
      answer: marked,
      // einen Strich verzählt, jeder Strich als 1 gezählt, vom falschen Nachbarn aus gezählt
      distractors: [marked + line.step, marked - line.step, marked + 2 * line.step, marked - 2 * line.step, label + count, label + line.labelEvery - count * line.step],
      explanation: [
        `Ein Strich bedeutet ${expr(line.step)}.`,
        backwards ? `Von ${expr(from)} aus ${strokes} zurück:` : `Von ${expr(from)} aus ${strokes} weiter:`,
        expr(from, backwards ? '−' : PLUS, steps, TIMES, line.step, '=', marked),
      ],
      max,
    }),
  );
}

/** Abschnitt ab einem zufälligen Vielfachen von `size` (z. B. 300 bis 400) */
const section = (rng: Rng, size: number, max: number, step: number, labelEvery: number): Line => {
  const start = rng.int(0, max / size - 1) * size;
  return { start, end: start + size, step, labelEvery };
};

export const k1NumberLine = generator('k1-number-line', ({ difficulty, rng }) =>
  numberLineTask(
    rng,
    byDifficulty<Line>(difficulty, {
      easy: () => ({ start: 0, end: 10, step: 1, labelEvery: 5 }),
      medium: () => ({ start: 0, end: 20, step: 1, labelEvery: 5 }),
      // nur 0, 10 und 20 beschriftet
      hard: () => ({ start: 0, end: 20, step: 1, labelEvery: 10 }),
    }),
    20,
  ),
);

export const k2NumberLine = generator('k2-number-line', ({ difficulty, rng }) =>
  numberLineTask(
    rng,
    byDifficulty<Line>(difficulty, {
      easy: () => ({ start: 0, end: 100, step: 10, labelEvery: 50 }),
      // Einer zwischen zwei Zehnern: 40 … 60
      medium: () => section(rng, 20, 100, 1, 10),
      // Fünferschritte bis 100
      hard: () => ({ start: 0, end: 100, step: 5, labelEvery: 50 }),
    }),
    100,
  ),
);

export const k3NumberLine = generator('k3-number-line', ({ difficulty, rng }) =>
  numberLineTask(
    rng,
    byDifficulty<Line>(difficulty, {
      // Hunderter auf dem Strahl bis 1 000 oder Zehner bis 100
      easy: () => (rng.chance(0.5) ? { start: 0, end: 1000, step: 100, labelEvery: 500 } : { start: 0, end: 100, step: 10, labelEvery: 50 }),
      // Zehner zwischen zwei Hundertern
      medium: () => section(rng, 100, 1000, 10, 50),
      // Einer zwischen zwei Zehnern oder Fünferschritte
      hard: () => (rng.chance(0.5) ? section(rng, 20, 1000, 1, 10) : section(rng, 100, 1000, 5, 50)),
    }),
    1000,
  ),
);

export const k4NumberLine = generator('k4-number-line', ({ difficulty, rng }) =>
  numberLineTask(
    rng,
    byDifficulty<Line>(difficulty, {
      // Tausender bis 10 000
      easy: () => ({ start: 0, end: 10_000, step: 1000, labelEvery: 5000 }),
      // Hunderter zwischen zwei Tausendern
      medium: () => section(rng, 1000, 10_000, 100, 500),
      // Zehntausender bis 100 000 oder auf dem Strahl bis 1 Million
      hard: () => (rng.chance(0.5) ? section(rng, 100_000, 1_000_000, 10_000, 50_000) : { start: 0, end: 1_000_000, step: 100_000, labelEvery: 500_000 }),
    }),
    1_000_000,
  ),
);

// ---- Daten ablesen (Kl. 2–4) ---------------------------------------------------------------------------

const SURVEYS: readonly { readonly topic: string; readonly options: readonly string[] }[] = [
  { topic: 'Lieblingsobst', options: ['Äpfel', 'Bananen', 'Birnen', 'Kirschen', 'Trauben'] },
  { topic: 'Lieblingstier', options: ['Hund', 'Katze', 'Pferd', 'Hase', 'Fisch'] },
  { topic: 'Lieblingsfarbe', options: ['Rot', 'Blau', 'Grün', 'Gelb', 'Lila'] },
  { topic: 'Schulweg', options: ['Zu Fuß', 'Fahrrad', 'Bus', 'Auto', 'Roller'] },
  { topic: 'Lieblingssport', options: ['Fußball', 'Schwimmen', 'Turnen', 'Reiten', 'Tanzen'] },
];

type Question = 'read' | 'diff' | 'sum';

interface DataLevel {
  readonly max: number;
  readonly gridStep: number;
  readonly labelStep: number;
  /** Alle Werte sind Vielfache davon (≥ `gridStep`, damit jede Säule auf einer Hilfslinie endet) */
  readonly unit: number;
  /** Wer gefragt wurde – größere Zahlen = größere Gruppe, damit die Summe realistisch bleibt */
  readonly group: string;
  readonly questions: readonly Question[];
}

function dataTask(rng: Rng, level: DataLevel): GeneratedTask {
  const survey = rng.pick(SURVEYS);
  const labels = rng.shuffle([...survey.options]).slice(0, 4);
  // verschiedene Werte, damit jede Säule eindeutig ist
  const values = sample(
    rng,
    (r) => labels.map(() => level.unit * r.int(1, level.max / level.unit)),
    (v) => new Set(v).size === v.length,
  );
  const bars = labels.map((label, i) => ({ label, value: values[i] }));
  const figure: BarChartFigure = { kind: 'bars', bars, max: level.max, gridStep: level.gridStep, labelStep: level.labelStep };
  const instruction = `Umfrage ${level.group}: ${survey.topic}`;
  const question = rng.pick(level.questions);
  const [a, b] = rng.shuffle([...bars]);
  const [high, low] = a.value > b.value ? [a, b] : [b, a];
  const sum = values.reduce((x, y) => x + y, 0);

  const task =
    question === 'read'
      ? integerTask({
          instruction,
          prompt: `Wie viele Kinder haben „${a.label}“ gewählt?`,
          answer: a.value,
          // Nachbarsäule abgelesen, eine Hilfslinie daneben
          distractors: [...values, a.value + level.gridStep, a.value - level.gridStep],
          explanation: [`Die Säule „${a.label}“ reicht bis ${a.value}.`],
        })
      : question === 'diff'
        ? integerTask({
            instruction,
            prompt: `Wie viele Kinder mehr haben „${high.label}“ als „${low.label}“ gewählt?`,
            answer: high.value - low.value,
            // nur eine Säule abgelesen, addiert statt verglichen
            distractors: [high.value, low.value, high.value + low.value, high.value - low.value + level.gridStep, high.value - low.value - level.gridStep].filter((v) => v > 0),
            explanation: [`„${high.label}“: ${high.value}, „${low.label}“: ${low.value}`, expr(high.value, '−', low.value, '=', high.value - low.value)],
          })
        : integerTask({
            instruction,
            prompt: 'Wie viele Kinder wurden insgesamt gefragt?',
            answer: sum,
            // eine Säule vergessen, verrechnet
            distractors: [...values.map((v) => sum - v), sum + level.unit, sum - level.unit, sum + 10, sum - 10],
            explanation: [`${values.join(' + ')} = ${sum}`],
          });
  return integerFigureTask(figure, task);
}

export const k2Data = generator('k2-data', ({ difficulty, rng }) =>
  dataTask(
    rng,
    byDifficulty<DataLevel>(difficulty, {
      easy: () => ({ max: 10, gridStep: 1, labelStep: 2, unit: 1, group: 'in der Klasse 2a', questions: ['read'] }),
      medium: () => ({ max: 10, gridStep: 1, labelStep: 2, unit: 1, group: 'in der Klasse 2a', questions: ['read', 'diff', 'diff'] }),
      hard: () => ({ max: 20, gridStep: 2, labelStep: 4, unit: 2, group: 'in allen zweiten Klassen', questions: ['diff', 'sum'] }),
    }),
  ),
);

export const k3Data = generator('k3-data', ({ difficulty, rng }) =>
  dataTask(
    rng,
    byDifficulty<DataLevel>(difficulty, {
      easy: () => ({ max: 10, gridStep: 1, labelStep: 1, unit: 1, group: 'in der Klasse 3b', questions: ['read'] }),
      medium: () => ({ max: 20, gridStep: 2, labelStep: 4, unit: 2, group: 'in allen dritten Klassen', questions: ['read', 'diff', 'diff'] }),
      hard: () => ({ max: 50, gridStep: 5, labelStep: 10, unit: 5, group: 'an der ganzen Schule', questions: ['diff', 'sum'] }),
    }),
  ),
);

export const k4Data = generator('k4-data', ({ difficulty, rng }) =>
  dataTask(
    rng,
    byDifficulty<DataLevel>(difficulty, {
      easy: () => ({ max: 50, gridStep: 5, labelStep: 10, unit: 5, group: 'in allen vierten Klassen', questions: ['read'] }),
      medium: () => ({ max: 100, gridStep: 10, labelStep: 20, unit: 10, group: 'an der ganzen Schule', questions: ['read', 'diff', 'diff'] }),
      hard: () => ({ max: 100, gridStep: 5, labelStep: 20, unit: 5, group: 'an der ganzen Schule', questions: ['diff', 'sum'] }),
    }),
  ),
);

export const FIGURE_GENERATORS: readonly TaskGenerator[] = [
  k1NumberLine,
  k2Clock,
  k2NumberLine,
  k2Data,
  k3GridArea,
  k3Symmetry,
  k3NumberLine,
  k3Data,
  k3Solids,
  k3Chance,
  k4NumberLine,
  k4Data,
  k4Symmetry,
  k4Chance,
  k5FractionPicture,
  k5Angles,
  k8GraphReading,
];
