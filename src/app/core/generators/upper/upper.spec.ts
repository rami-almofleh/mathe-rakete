import katex from 'katex';
import { TOPICS } from '../../curriculum/curriculum';
import { Difficulty, MathContent, Task } from '../../models';
import { Rng } from '../../math/rng';
import { createDefaultRegistry } from '../all-generators';
import { tryCreateTask } from '../task-factory';
import { evaluateNumeric, leftOfQuestion, normalizeFormula } from '../testing/formula-parser';

/**
 * Massentest Kl. 11–12. Unabhängige Prüfung:
 * - Ableitungen numerisch (Differenzenquotient der angezeigten Funktion)
 * - Integrale mit der Simpson-Regel
 * - Binomialwahrscheinlichkeiten durch Aufzählen aller 2ⁿ Ergebnisfolgen
 */

const RUNS = 400;
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const UPPER_TOPICS = TOPICS.filter((t) => t.grade >= 11);
const registry = createDefaultRegistry();

const E = { e: Math.E };
const clean = (s: string) => normalizeFormula(s).replace(/≈\s*/, '');
const numbers = (text: string) => [...clean(text).matchAll(/-?\d+(?:,\d+)?/g)].map((m) => Number(m[0].replace(',', '.')));
const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const round = (x: number, places: number) => (Math.sign(x) * Math.round(Number((Math.abs(x) * 10 ** places).toPrecision(12)))) / 10 ** places;

/** f aus „f(x) = …“ bzw. einem Term mit x */
const fn = (body: string) => (x: number) => evaluateNumeric(body.replace(/^[fFt]\(x\) = /, '').replace(/ \+ C$/, ''), { x, ...E });

const SAMPLE_POINTS = [0.7, 1.3, 2.1];
function derivativeMatches(f: (x: number) => number, g: (x: number) => number): boolean {
  const h = 1e-5;
  return SAMPLE_POINTS.every((x) => close((f(x + h) - f(x - h)) / (2 * h), g(x), 1e-4));
}

function simpson(f: (x: number) => number, a: number, b: number, n = 1000): number {
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += f(a + i * h) * (i % 2 ? 4 : 2);
  return (sum * h) / 3;
}

function vectorsIn(text: string): string[][] {
  return [...text.matchAll(/\\begin\{pmatrix\}(.*?)\\end\{pmatrix\}/g)].map((m) => m[1].split('\\\\').map((c) => c.trim()));
}

function roundedIs(choice: string, exact: number, places: number, unit: string): boolean {
  const m = /^≈ (-?[\d\u202f]+(?:,\d+)?)(.*)$/.exec(choice);
  if (!m || m[2].trim() !== unit) return false;
  return (m[1].split(',')[1]?.length ?? 0) === places && close(Number(m[1].replace(/\u202f/g, '').replace(',', '.')), round(exact, places));
}

type Judge = (choice: string) => boolean;

function judgeFor(task: Task): Judge {
  const prompt = task.prompt.math.value;
  const instruction = task.prompt.instruction ?? '';

  switch (task.topicId) {
    case 'k11-roots-polynomials': {
      const f = fn(prompt);
      const zeros = Array.from({ length: 101 }, (_, i) => i - 50).filter((x) => Math.abs(f(x)) < 1e-9);
      return (c) => {
        const values = c.split(', ').map((part) => numbers(part.split('=')[1])[0]);
        return values.length === zeros.length && zeros.every((z) => values.includes(z));
      };
    }
    case 'k11-derivative-rules':
    case 'k12-derivative-advanced':
      return (c) => derivativeMatches(fn(prompt), fn(c));
    case 'k12-exp-ln': {
      if (instruction.startsWith("Bestimme f'")) return (c) => derivativeMatches(fn(prompt), fn(c));
      if (instruction.startsWith('Löse')) {
        const [left, right] = prompt.split(' = ');
        return (c) => {
          const x = evaluateNumeric(c.replace('x = ', ''), E);
          return close(evaluateNumeric(left, { x, ...E }), evaluateNumeric(right));
        };
      }
      const value = evaluateNumeric(leftOfQuestion(prompt), E);
      return (c) => close(evaluateNumeric(c, E), value);
    }
    case 'k11-tangent-slope': {
      const f = fn(prompt);
      const x0 = numbers(instruction)[0]; // „x₀ = −2“: die tiefgestellte 0 ist keine Ziffer
      const h = 1e-5;
      const slope = (f(x0 + h) - f(x0 - h)) / (2 * h);
      if (instruction.includes('Tangente')) {
        return (c) => {
          const t = fn(c);
          return close(t(x0), f(x0), 1e-9) && close(t(1) - t(0), slope, 1e-4);
        };
      }
      return (c) => close(evaluateNumeric(c), slope, 1e-4);
    }
    case 'k11-extrema': {
      const f = fn(prompt);
      const h = 1e-4;
      return (c) => {
        const m = /^([HT])\((-?\d+) \\mid (-?\d+)\)$/.exec(c);
        if (!m) return false;
        const [kind, x, y] = [m[1], Number(m[2]), Number(m[3])];
        const d1 = (f(x + h) - f(x - h)) / (2 * h);
        const d2 = (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
        const actual = d2 < 0 ? 'H' : 'T';
        const wanted = instruction.includes('Hochpunkt') ? 'H' : instruction.includes('Tiefpunkt') ? 'T' : actual;
        return Math.abs(d1) < 1e-4 && close(f(x), y) && kind === actual && kind === wanted;
      };
    }
    case 'k11-vectors': {
      if (instruction.includes('Betrag')) {
        const [v] = vectorsIn(prompt);
        const length = Math.sqrt(v.reduce((s, x) => s + evaluateNumeric(x) ** 2, 0));
        return (c) => close(evaluateNumeric(c), length);
      }
      if (instruction.includes('Summe')) {
        const [a, b] = vectorsIn(prompt).map((v) => v.map((x) => evaluateNumeric(x)));
        return (c) => vectorsIn(c)[0].every((x, i) => close(evaluateNumeric(x), a[i] + b[i]));
      }
      const [A, B] = prompt.split(', \\quad ').map((p) => numbers(p.replace(/\\mid/g, ' ')));
      return (c) => vectorsIn(c)[0].every((x, i) => close(evaluateNumeric(x), B[i] - A[i]));
    }
    case 'k12-integrals': {
      if (instruction.includes('Stammfunktion')) {
        const f = fn(prompt);
        return (c) => c.endsWith(' + C') && derivativeMatches(fn(c), f);
      }
      const m = /\\int_\{(-?\d+)\}\^\{(-?\d+)\} \\left\((.+)\\right\)\\,dx/.exec(prompt)!;
      const value = simpson((x) => evaluateNumeric(m[3], { x }), Number(m[1]), Number(m[2]));
      return (c) => close(evaluateNumeric(c), value, 1e-7);
    }
    case 'k12-dot-product': {
      const vs = vectorsIn(prompt);
      if (instruction.includes('senkrecht')) {
        return (c) => {
          const t = evaluateNumeric(c.replace('t = ', ''));
          const [u, v] = vs.map((vec) => vec.map((x) => evaluateNumeric(x, { t })));
          return close(u.reduce((s, x, i) => s + x * v[i], 0), 0);
        };
      }
      const [u, v] = vs.map((vec) => vec.map((x) => evaluateNumeric(x)));
      const dot = u.reduce((s, x, i) => s + x * v[i], 0);
      if (instruction.includes('Winkel')) {
        const angle = (Math.acos(dot / (Math.hypot(...u) * Math.hypot(...v))) * 180) / Math.PI;
        return (c) => roundedIs(c, angle, 1, '°');
      }
      return (c) => close(evaluateNumeric(c), dot);
    }
    case 'k12-stochastics': {
      if (instruction.includes('Erwartungswert')) {
        const [n, p] = numbers(prompt.replace(/;/g, ' '));
        return (c) => close(evaluateNumeric(c), n * p);
      }
      if (instruction.includes('sportliche')) {
        const [, sport, both] = numbers(prompt);
        return (c) => close(evaluateNumeric(c), both / sport);
      }
      const [pNum, pDen, n, k] = numbers(instruction.replace('/', ' '));
      const p = pNum / pDen;
      let total = 0;
      for (let mask = 0; mask < 2 ** n; mask++) {
        const successes = mask.toString(2).split('').filter((b) => b === '1').length;
        if (successes === k) total += p ** k * (1 - p) ** (n - k);
      }
      return (c) => close(evaluateNumeric(c), total);
    }
  }
  const value = evaluateNumeric(leftOfQuestion(prompt), E);
  return (c) => close(evaluateNumeric(c, E), value);
}

function contents(task: Task): MathContent[] {
  return [task.prompt.math, ...task.choices.map((c) => c.display), ...(task.explanation ?? [])];
}

function verify(task: Task): string | null {
  for (const content of contents(task)) {
    if (content.kind === 'tex') {
      try {
        katex.renderToString(content.value, { throwOnError: true, strict: 'error' });
      } catch (error) {
        return `KaTeX-Fehler in „${content.value}“: ${(error as Error).message}`;
      }
    } else if (content.value.includes('\\')) {
      return `LaTeX im Klartext: „${content.value}“`;
    }
  }
  if (!task.explanation?.length) return 'kein Lösungsweg';
  const choices = task.choices.map((c) => c.display.value);
  let judge: Judge;
  try {
    judge = judgeFor(task);
  } catch (error) {
    return `Aufgabe nicht lesbar: ${task.prompt.instruction ?? ''} ${task.prompt.math.value} (${(error as Error).message})`;
  }
  const verdicts = choices.map((c) => {
    try {
      return judge(c);
    } catch {
      return false;
    }
  });
  const correct = verdicts.filter(Boolean).length;
  if (correct !== 1) return `${correct} richtige Antworten: ${task.prompt.instruction ?? ''} ${task.prompt.math.value} | ${choices.join(' | ')}`;
  if (!verdicts[task.correctIndex]) return `falscher correctIndex: ${task.prompt.math.value} | ${choices.join(' | ')}`;
  return null;
}

describe('grade 11–12 generators', () => {
  it('cover every topic of grades 11–12', () => {
    expect(UPPER_TOPICS.filter((t) => !registry.has(t.id)).map((t) => t.id)).toEqual([]);
  });

  for (const topic of UPPER_TOPICS) {
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
          const task = result.task;
          variants.add([task.prompt.instruction, task.prompt.math.value, ...task.choices.map((c) => c.display.value).sort()].join('|'));
          const problem = verify(task);
          if (problem) problems.push(`Seed ${seed}: ${problem}`);
        }
        expect(problems).toEqual([]);
        expect(variants.size).toBeGreaterThanOrEqual(8);
      });
    }
  }
});
