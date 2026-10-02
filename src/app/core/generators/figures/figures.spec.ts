import katex from 'katex';
import { TestBed } from '@angular/core/testing';
import { TOPICS } from '../../curriculum/curriculum';
import { Difficulty, Figure, Task } from '../../models';
import { Rng } from '../../math/rng';
import { FigureView } from '../../../shared/figure/figure-view';
import { createDefaultRegistry } from '../all-generators';
import { tryCreateTask } from '../task-factory';
import { evaluateNumeric } from '../testing/formula-parser';

/** Massentest Bild-Aufgaben: Die richtige Antwort wird unabhängig aus den Bilddaten bestimmt. */

const RUNS = 500;
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const FIGURE_TOPICS = TOPICS.filter((t) => t.figure);
const registry = createDefaultRegistry();

const frac = (c: string) => {
  const m = /\\frac\{(\d+)\}\{(\d+)\}/.exec(c);
  return m ? [Number(m[1]), Number(m[2])] : null;
};
const gcdOf = (a: number, b: number): number => (b === 0 ? a : gcdOf(b, a % b));
/** „1 000“ (mit schmalem Leerzeichen) → 1000; alles andere als eine ganze Zahl → NaN */
const readInt = (c: string) => (/^[\d\s\u202f]+$/.test(c) ? Number(c.replace(/[\s\u202f]/g, '')) : NaN);

function perimeterOf(cells: readonly (readonly [number, number])[]): number {
  const set = new Set(cells.map(([c, r]) => `${c},${r}`));
  let edges = 0;
  for (const [c, r] of cells) {
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!set.has(`${c + dc},${r + dr}`)) edges++;
  }
  return edges;
}

function angleType(a: number): string {
  if (a < 90) return 'spitzer Winkel';
  if (a === 90) return 'rechter Winkel';
  if (a < 180) return 'stumpfer Winkel';
  if (a === 180) return 'gestreckter Winkel';
  return 'überstumpfer Winkel';
}

function judgeFor(task: Task): (choice: string) => boolean {
  const figure = task.prompt.figure as Figure;
  const question = task.prompt.math.value;
  switch (figure.kind) {
    case 'clock':
      return (c) => c === `${figure.hours}:${String(figure.minutes).padStart(2, '0')} Uhr`;
    case 'grid': {
      const cellsInside = figure.cells.every(([c, r]) => c >= 0 && r >= 0 && c < figure.columns && r < figure.rows);
      expect(cellsInside).toBe(true);
      if (figure.axis) {
        // Spiegelseite muss eine Teilmenge des Spiegelbilds sein; gesucht: wie viele fehlen
        const { orientation, at } = figure.axis;
        const before = figure.cells.filter(([c, r]) => (orientation === 'vertical' ? c : r) < at);
        const after = new Set(figure.cells.filter(([c, r]) => (orientation === 'vertical' ? c : r) >= at).map(([c, r]) => `${c},${r}`));
        const mirrored = before.map(([c, r]) => (orientation === 'vertical' ? `${2 * at - 1 - c},${r}` : `${c},${2 * at - 1 - r}`));
        expect([...after].every((k) => mirrored.includes(k))).toBe(true);
        const missing = mirrored.filter((k) => !after.has(k)).length;
        expect(missing).toBeGreaterThan(0);
        return (c) => readInt(c) === missing;
      }
      return question.includes('Flächeninhalt') ? (c) => c === `${figure.cells.length} cm²` : (c) => c === `${perimeterOf(figure.cells)} cm`;
    }
    case 'angle':
      return question.includes('Art') ? (c) => c === angleType(figure.degrees) : (c) => c === `${figure.degrees}°`;
    case 'fraction': {
      expect(new Set(figure.filled).size).toBe(figure.filled.length);
      expect(figure.filled.every((i) => i >= 0 && i < figure.parts)).toBe(true);
      const [k, n] = [figure.filled.length, figure.parts];
      if (question.includes('gekürzt')) {
        return (c) => {
          const f = frac(c);
          return !!f && f[0] * n === k * f[1] && gcdOf(f[0], f[1]) === 1;
        };
      }
      const target = question.includes('NICHT') ? n - k : k;
      return (c) => {
        const f = frac(c);
        return !!f && f[0] * n === target * f[1];
      };
    }
    case 'numberline': {
      // fair: Pfeil auf einem Strich, aber nicht auf einer beschrifteten Zahl
      expect((figure.marked - figure.start) % figure.step).toBe(0);
      expect(figure.marked % figure.labelEvery).not.toBe(0);
      expect(figure.marked > figure.start && figure.marked < figure.end).toBe(true);
      return (c) => readInt(c) === figure.marked;
    }
    case 'bars': {
      // ablesbar: jede Säule endet auf einer Hilfslinie, alle verschieden
      expect(figure.bars.every((b) => b.value > 0 && b.value <= figure.max && b.value % figure.gridStep === 0)).toBe(true);
      expect(new Set(figure.bars.map((b) => b.value)).size).toBe(figure.bars.length);
      const value = (label: string) => figure.bars.find((b) => b.label === label)!.value;
      const named = [...question.matchAll(/„([^“]+)“/g)].map((m) => m[1]);
      const expected = question.includes('insgesamt')
        ? figure.bars.reduce((s, b) => s + b.value, 0)
        : named.length === 2
          ? value(named[0]) - value(named[1])
          : value(named[0]);
      expect(expected).toBeGreaterThan(0);
      return (c) => readInt(c) === expected;
    }
    case 'solid': {
      const names: Record<string, string> = { cube: 'Würfel', cuboid: 'Quader', pyramid: 'Pyramide', prism: 'Prisma', cylinder: 'Zylinder', cone: 'Kegel', sphere: 'Kugel' };
      // Euler: Ecken − Kanten + Flächen = 2 – unabhängig vom Generator nachgerechnet
      const solids: Record<string, { Ecken: number; Kanten: number; Flächen: number }> = {
        cube: { Ecken: 8, Kanten: 12, Flächen: 6 },
        cuboid: { Ecken: 8, Kanten: 12, Flächen: 6 },
        pyramid: { Ecken: 5, Kanten: 8, Flächen: 5 },
        prism: { Ecken: 6, Kanten: 9, Flächen: 5 },
      };
      for (const c of Object.values(solids)) expect(c.Ecken - c.Kanten + c.Flächen).toBe(2);
      const roundFaces: Record<string, number> = { cylinder: 3, cone: 2, sphere: 1 };
      if (question === 'Wie heißt dieser Körper?') return (c) => c === names[figure.shape];
      const what = question.match(/^Wie viele (Ecken|Kanten|Flächen) hat/)![1] as 'Ecken' | 'Kanten' | 'Flächen';
      const expected = solids[figure.shape]?.[what] ?? (what === 'Flächen' ? roundFaces[figure.shape] : NaN);
      return (c) => readInt(c) === expected;
    }
    case 'urn': {
      const count = (bag: number, color: string) => figure.bags[bag].balls.find((b) => b.color === color)?.count ?? 0;
      const total = (bag: number) => figure.bags[bag].balls.reduce((s, b) => s + b.count, 0);
      expect(figure.bags.every((_, i) => total(i) <= 25)).toBe(true);
      const event = question.match(/Sie ist (.+)\. Das ist …$/);
      if (event) {
        const colors = event[1].split(' oder ');
        const hits = colors.reduce((s, c) => s + count(0, c), 0);
        const expected = hits === 0 ? 'unmöglich' : hits === total(0) ? 'sicher' : 'möglich';
        return (c) => c === expected;
      }
      const more = question.match(/^Wie viele (\S+)e Kugeln musst du dazulegen/);
      if (more) {
        const other = figure.bags[0].balls.find((b) => b.color !== more[1])!;
        return (c) => readInt(c) === other.count - count(0, more[1]);
      }
      if (question.includes('In welchem Beutel')) {
        const [pA, pB] = [count(0, 'rot') / total(0), count(1, 'rot') / total(1)];
        const expected = Math.abs(pA - pB) < 1e-9 ? 'gleich wahrscheinlich' : pA > pB ? 'Beutel A' : 'Beutel B';
        return (c) => c === expected;
      }
      const balls = [...figure.bags[0].balls].sort((a, b) => b.count - a.count);
      if (question.includes('am seltensten')) {
        expect(balls.at(-1)!.count).toBeLessThan(balls.at(-2)!.count);
        return (c) => c === balls.at(-1)!.color;
      }
      if (balls[0].count === balls[1].count) return (c) => c === 'gleich wahrscheinlich';
      return (c) => c === balls[0].color;
    }
    case 'graph': {
      const [line] = figure.lines;
      // zwei Gitterpunkte der gezeichneten Geraden
      const points = [0, line.run].map((x) => [x, line.b + (line.rise * x) / line.run] as const);
      return (c) => points.every(([x, y]) => Math.abs(evaluateNumeric(c, { x }) - y) < 1e-9);
    }
  }
}

function verify(task: Task): string | null {
  if (!task.prompt.figure) return 'kein Bild';
  for (const content of [task.prompt.math, ...task.choices.map((c) => c.display), ...(task.explanation ?? [])]) {
    if (content.kind === 'tex') {
      try {
        katex.renderToString(content.value, { throwOnError: true, strict: 'error' });
      } catch (error) {
        return `KaTeX-Fehler: ${(error as Error).message}`;
      }
    }
  }
  const judge = judgeFor(task);
  const choices = task.choices.map((c) => c.display.value);
  const verdicts = choices.map((c) => {
    try {
      return judge(c);
    } catch {
      return false;
    }
  });
  if (verdicts.filter(Boolean).length !== 1) return `${verdicts.filter(Boolean).length} richtige: ${JSON.stringify(task.prompt.figure)} | ${choices.join(' | ')}`;
  if (!verdicts[task.correctIndex]) return 'falscher correctIndex';
  if (task.prompt.figure.kind === 'angle' && !task.prompt.math.value.includes('Art')) {
    // Schätzen muss fair sein: Antworten mindestens 25° auseinander
    const values = choices.map((c) => Number(c.replace('°', ''))).sort((a, b) => a - b);
    if (values.some((v, i) => i > 0 && v - values[i - 1] < 25)) return `Winkel zu nah beieinander: ${choices}`;
  }
  return null;
}

describe('figure generators', () => {
  it('have a generator for every picture topic', () => {
    expect(FIGURE_TOPICS.map((t) => t.id).sort()).toEqual([
      'k1-number-line',
      'k2-clock',
      'k2-data',
      'k2-number-line',
      'k3-chance',
      'k3-data',
      'k3-grid-area',
      'k3-number-line',
      'k3-solids',
      'k3-symmetry',
      'k4-chance',
      'k4-data',
      'k4-number-line',
      'k4-symmetry',
      'k5-angles',
      'k5-fraction-picture',
      'k8-graph-reading',
    ]);
    expect(FIGURE_TOPICS.every((t) => registry.has(t.id))).toBe(true);
  });

  for (const topic of FIGURE_TOPICS) {
    for (const difficulty of DIFFICULTIES) {
      it(`${topic.id} (${difficulty}): ${RUNS} valid, independently verified tasks`, () => {
        const problems: string[] = [];
        const variants = new Set<string>();
        for (let seed = 0; seed < RUNS && problems.length < 5; seed++) {
          const result = tryCreateTask(registry.get(topic.id)!, { id: `${seed}`, grade: topic.grade, difficulty, rng: new Rng(seed) });
          if (!result.ok) {
            problems.push(`Seed ${seed}: ${result.problem}`);
            continue;
          }
          variants.add(JSON.stringify(result.task.prompt.figure) + result.task.prompt.math.value);
          const problem = verify(result.task);
          if (problem) problems.push(`Seed ${seed}: ${problem}`);
        }
        expect(problems).toEqual([]);
        // Körper gibt es nur sieben – dort reichen fünf verschiedene Bild-Frage-Paare
        expect(variants.size).toBeGreaterThanOrEqual(topic.id.endsWith('-solids') ? 5 : 8);
      });
    }
  }
});

describe('FigureView', () => {
  async function render(figure: Figure) {
    const fixture = TestBed.createComponent(FigureView);
    fixture.componentRef.setInput('figure', figure);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws the clock hands at the right angle', async () => {
    const el = await render({ kind: 'clock', hours: 3, minutes: 0 });
    const hour = el.querySelector('.hand-hour')!;
    const minute = el.querySelector('.hand-minute')!;
    // 3 Uhr: Stundenzeiger nach rechts, Minutenzeiger nach oben
    expect(Number(hour.getAttribute('x2'))).toBeGreaterThan(140);
    expect(Math.abs(Number(hour.getAttribute('y2')) - 100)).toBeLessThan(1);
    expect(Math.abs(Number(minute.getAttribute('x2')) - 100)).toBeLessThan(1);
    expect(Number(minute.getAttribute('y2'))).toBeLessThan(40);
    expect(el.querySelectorAll('.clock-number').length).toBe(12);
  });

  it('draws grid cells, fraction parts and the graph line', async () => {
    expect((await render({ kind: 'grid', columns: 5, rows: 4, cells: [[1, 1], [2, 1], [1, 2]] })).querySelectorAll('.cell').length).toBe(3);
    const fraction = await render({ kind: 'fraction', shape: 'circle', parts: 8, filled: [0, 3, 5] });
    expect(fraction.querySelectorAll('path.part').length).toBe(8);
    expect(fraction.querySelectorAll('.part-filled').length).toBe(3);
    const graph = await render({ kind: 'graph', range: 5, lines: [{ rise: 1, run: 1, b: 0 }] });
    const line = graph.querySelector('.graph-line')!;
    // y = x geht durch die Ecken des Bereichs (−5|−5) und (5|5)
    expect(Number(line.getAttribute('x1'))).toBeCloseTo(10);
    expect(Number(line.getAttribute('y1'))).toBeCloseTo(210);
  });

  it('draws the number line with labels and the arrow', async () => {
    const el = await render({ kind: 'numberline', start: 300, end: 400, step: 10, labelEvery: 50, marked: 370 });
    expect(el.querySelectorAll('.nl-tick').length).toBe(11);
    expect([...el.querySelectorAll('.nl-label')].map((t) => t.textContent)).toEqual(['300', '350', '400']);
    // 370 liegt bei 70 % der Strecke 20…300
    expect(Number(el.querySelector('line.nl-arrow')!.getAttribute('x1'))).toBeCloseTo(216);
  });

  it('draws one bar per answer, scaled to the axis, without printing the values', async () => {
    const el = await render({ kind: 'bars', bars: [{ label: 'Hund', value: 5 }, { label: 'Katze', value: 10 }], max: 10, gridStep: 1, labelStep: 1 });
    const bars = [...el.querySelectorAll('rect.bar')];
    expect(bars.length).toBe(2);
    expect(Number(bars[1].getAttribute('height'))).toBeCloseTo(2 * Number(bars[0].getAttribute('height')));
    expect(el.querySelector('[role="img"]')!.getAttribute('aria-label')).not.toMatch(/\d{2}/);
  });

  it('describes the picture for screen readers without giving away the time', async () => {
    const el = await render({ kind: 'clock', hours: 7, minutes: 30 });
    const label = el.querySelector('[role="img"]')!.getAttribute('aria-label')!;
    expect(label).toContain('Uhr');
    expect(label).not.toMatch(/\d/);
  });
});
