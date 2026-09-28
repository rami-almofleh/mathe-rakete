import { Figure, GridFigure, plain, tex } from '../../models';
import { formatInteger } from '../../math/format';
import { gcd } from '../../math/number-theory';
import { Polynomial } from '../../math/polynomial';
import { Rational } from '../../math/rational';
import { Rng } from '../../math/rng';
import { textAnswer } from '../answers';
import { Answer, GeneratedTask, TaskGenerator } from '../generator';
import { polyAnswer, signed } from '../middle/helpers';
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

export const FIGURE_GENERATORS: readonly TaskGenerator[] = [k2Clock, k3GridArea, k5FractionPicture, k5Angles, k8GraphReading];
