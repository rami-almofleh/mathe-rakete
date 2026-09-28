import katex from 'katex';
import { TOPICS } from '../../curriculum/curriculum';
import { Difficulty, MathContent, Task } from '../../models';
import { Rng } from '../../math/rng';
import { createDefaultRegistry } from '../all-generators';
import { tryCreateTask } from '../task-factory';
import { evaluateNumeric, leftOfQuestion, normalizeFormula } from '../testing/formula-parser';

/**
 * Massentest Kl. 8–10: Jede Aufgabe wird aus dem angezeigten Text unabhängig nachgerechnet –
 * oft auf einem anderen Weg als im Generator (z. B. Wahrscheinlichkeiten durch Abzählen aller
 * Ausgänge, Scheitelpunkt und Diskriminante aus Funktionswerten).
 */

const RUNS = 500;
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const MIDDLE_TOPICS = TOPICS.filter((t) => t.grade >= 8 && t.grade <= 10 && !t.figure); // Bild-Aufgaben: figures.spec.ts
const registry = createDefaultRegistry();
const EPS = 1e-9;

// ---- Hilfen ----------------------------------------------------------------------------------

const clean = (s: string) => normalizeFormula(s).replace(/≈\s*/, '');
const numbers = (text: string) => [...clean(text).matchAll(/-?\d+(?:,\d+)?/g)].map((m) => Number(m[0].replace(',', '.')));
const close = (a: number, b: number) => Math.abs(a - b) < EPS * Math.max(1, Math.abs(b));
const round = (x: number, places: number) => (Math.sign(x) * Math.round(Number((Math.abs(x) * 10 ** places).toPrecision(12)))) / 10 ** places;
const gcdOf = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcdOf(b, a % b));
const squareFree = (n: number) => Array.from({ length: Math.floor(Math.sqrt(n)) }, (_, i) => i + 2).every((k) => n % (k * k) !== 0);

/** „≈ 13,9 m“ passt zu 13,94…, wenn auf `places` Stellen gerundet und die Einheit stimmt. */
function roundedIs(choice: string, exact: number, places: number, unit: string): boolean {
  const m = /^≈ (-?[\d\u202f]+(?:,\d+)?)\s?(.*)$/.exec(choice);
  if (!m || m[2] !== unit) return false;
  const shown = Number(m[1].replace(/\u202f/g, '').replace(',', '.'));
  const decimals = m[1].split(',')[1]?.length ?? 0;
  return decimals === places && close(shown, round(exact, places));
}

function quantityIs(choice: string, value: number, unit: string): boolean {
  const m = /^(-?[\d\u202f]+(?:,\d+)?) (.+)$/.exec(choice);
  return !!m && m[2] === unit && close(Number(m[1].replace(/\u202f/g, '').replace(',', '.')), value);
}

/** f(x) aus einer angezeigten Funktion „f(x) = …“ */
const fn = (prompt: string) => {
  const body = prompt.replace(/^f\(x\) = /, '');
  return (x: number) => evaluateNumeric(body, { x });
};

/** a, b, c eines quadratischen Terms aus drei Funktionswerten – unabhängig von der Darstellung. */
function quadraticCoefficients(f: (x: number) => number): [number, number, number] {
  const c = f(0);
  const a = (f(1) + f(-1)) / 2 - c;
  const b = (f(1) - f(-1)) / 2;
  return [a, b, c];
}

function sameFunction(a: string, b: string, variables = ['x']): boolean {
  const points = [-3, 2, 5, 0.5];
  return points.every((p) => {
    const env = Object.fromEntries(variables.map((v, i) => [v, p + i]));
    return close(evaluateNumeric(a, env), evaluateNumeric(b, env));
  });
}

// Wahrscheinlichkeiten durch Abzählen
function enumerate<T>(outcomes: T[][], event: (o: T[]) => boolean): number {
  let hits = 0;
  let total = 0;
  const walk = (i: number, path: T[]) => {
    if (i === outcomes.length) {
      total++;
      if (event(path)) hits++;
      return;
    }
    for (const o of outcomes[i]) walk(i + 1, [...path, o]);
  };
  walk(0, []);
  return hits / total;
}

const DIE = [1, 2, 3, 4, 5, 6];

function probabilityFromText(text: string): number {
  if (text.startsWith('Ein Würfel wird einmal geworfen')) {
    const event = /P\((.+)\)\?/.exec(text)![1];
    const tests: Record<string, (n: number) => boolean> = {
      'eine gerade Zahl': (n) => n % 2 === 0,
      'eine ungerade Zahl': (n) => n % 2 === 1,
      'eine Zahl größer als 4': (n) => n > 4,
      'eine Zahl kleiner als 3': (n) => n < 3,
      'eine Primzahl': (n) => [2, 3, 5].includes(n),
      'eine 6': (n) => n === 6,
      'eine Zahl von 2 bis 5': (n) => n >= 2 && n <= 5,
      'eine Zahl, die durch 3 teilbar ist': (n) => n % 3 === 0,
    };
    return enumerate([DIE], ([n]) => tests[event](n));
  }
  if (text.startsWith('Zwei Würfel')) {
    const sum = Number(/Augensumme (\d+)/.exec(text)![1]);
    return enumerate([DIE, DIE], ([a, b]) => a + b === sum);
  }
  if (text.startsWith('In einer Urne')) {
    const [red, blue, green = 0] = numbers(text);
    return red / (red + blue + green);
  }
  if (text.startsWith('Urne:')) {
    const [red, blue] = numbers(text);
    const balls = [...Array(red).fill('r'), ...Array(blue).fill('b')];
    if (text.includes('mit Zurücklegen')) return enumerate([balls, balls], (o) => o.every((b) => b === 'r'));
    // ohne Zurücklegen: geordnete Paare verschiedener Kugeln
    const idx = balls.map((_, i) => i);
    let hits = 0;
    let total = 0;
    for (const i of idx) for (const j of idx) if (i !== j) {
      total++;
      if (balls[i] === 'r' && balls[j] === 'r') hits++;
    }
    return hits / total;
  }
  const coin = ['K', 'Z'];
  if (text.startsWith('Eine Münze')) {
    const n = text.includes('dreimal') ? 3 : 2;
    const stages: string[][] = Array.from({ length: n }, () => coin);
    const k = (o: string[]) => o.filter((x) => x === 'K').length;
    if (text.includes('genau einmal Kopf')) return enumerate(stages, (o) => k(o) === 1);
    if (text.includes('mindestens einmal Kopf')) return enumerate(stages, (o) => k(o) >= 1);
    return enumerate(stages, (o) => k(o) === n);
  }
  if (text.startsWith('Ein Würfel wird zweimal')) {
    const events: Record<string, (o: number[]) => boolean> = {
      'zweimal eine 6': ([a, b]) => a === 6 && b === 6,
      'zweimal eine gerade Zahl': ([a, b]) => a % 2 === 0 && b % 2 === 0,
      'erst eine 1, dann eine 2': ([a, b]) => a === 1 && b === 2,
      'zweimal dieselbe Zahl': ([a, b]) => a === b,
      'mindestens eine 6': ([a, b]) => a === 6 || b === 6,
    };
    const event = /P\((.+)\)\?/.exec(text)![1];
    return enumerate([DIE, DIE], events[event]);
  }
  throw new Error(`Unbekannter Zufallsversuch: ${text}`);
}

type Judge = (choice: string) => boolean;

function judgeFor(task: Task): Judge {
  const prompt = task.prompt.math.value;
  const instruction = task.prompt.instruction ?? '';

  switch (task.topicId) {
    case 'k8-expand-factor':
    case 'k8-binomial': {
      if (instruction.startsWith('Klammere')) {
        return (c) => {
          const m = /^(\d+)\((\d*)x ([+-]) (\d+)\)$/.exec(c);
          if (!m) return false;
          return sameFunction(c, prompt) && gcdOf(Number(m[2] || 1), Number(m[4])) === 1;
        };
      }
      return (c) => sameFunction(c, prompt);
    }
    case 'k8-equations-brackets': {
      const [left, right] = prompt.split(' = ');
      return (c) => {
        const x = numbers(c)[0];
        return close(evaluateNumeric(left, { x }), evaluateNumeric(right, { x }));
      };
    }
    case 'k8-linear-functions': {
      if (instruction.includes('Steigung der Geraden durch')) {
        const [xa, ya, xb, yb] = numbers(prompt);
        return (c) => close(evaluateNumeric(c), (yb - ya) / (xb - xa));
      }
      if (instruction.startsWith('Die Gerade hat')) {
        const [m, px, py] = numbers(prompt);
        return (c) => {
          const f = (x: number) => evaluateNumeric(c, { x });
          return close(f(px), py) && close(f(1) - f(0), m);
        };
      }
      const f = fn(prompt);
      if (instruction.includes('Nullstelle')) return (c) => close(f(evaluateNumeric(c.replace('x = ', ''))), 0);
      if (instruction.includes('Steigung')) return (c) => close(evaluateNumeric(c), f(1) - f(0));
      return (c) => close(evaluateNumeric(c), f(0));
    }
    case 'k8-areas': {
      const unit = /\d+ (\w+)/.exec(prompt)![1];
      const n = numbers(prompt);
      if (prompt.startsWith('Dreieck: A')) return (c) => quantityIs(c, (2 * n[0]) / n[1], unit);
      if (prompt.startsWith('Dreieck')) return (c) => quantityIs(c, (n[0] * n[1]) / 2, `${unit}²`);
      if (prompt.startsWith('Parallelogramm')) return (c) => quantityIs(c, n[0] * n[1], `${unit}²`);
      return (c) => quantityIs(c, ((n[0] + n[1]) / 2) * n[2], `${unit}²`);
    }
    case 'k8-laplace':
    case 'k10-tree-diagrams': {
      const p = probabilityFromText(prompt);
      return (c) => close(evaluateNumeric(c), p);
    }
    case 'k9-linear-systems': {
      const rows = clean(prompt).replace(/\\begin\{aligned\}|\\end\{aligned\}/g, '').split('\\\\');
      const equations = rows.map((row) => row.replace('&', '').split('='));
      return (c) => {
        const [x, y] = numbers(c);
        return equations.every(([l, r]) => close(evaluateNumeric(l, { x, y }), evaluateNumeric(r)));
      };
    }
    case 'k9-roots': {
      if (instruction.startsWith('Ziehe')) {
        const value = evaluateNumeric(prompt);
        return (c) => {
          const m = /^(\d+)\\sqrt\{(\d+)\}$/.exec(c);
          return !!m && squareFree(Number(m[2])) && close(evaluateNumeric(c), value);
        };
      }
      const value = evaluateNumeric(leftOfQuestion(prompt));
      return (c) => close(evaluateNumeric(c), value);
    }
    case 'k9-power-laws':
      return (c) => [2, 3].every((a) => close(evaluateNumeric(c, { a }), evaluateNumeric(prompt, { a })));
    case 'k9-quadratic-equations': {
      const body = prompt.replace(/ = 0$/, '');
      const [left, right] = body.includes(' = ') ? body.split(' = ') : [body, '0'];
      const f = (x: number) => evaluateNumeric(left, { x }) - evaluateNumeric(right);
      const [a, b, c0] = quadraticCoefficients(f);
      const discriminant = b * b - 4 * a * c0;
      const rootCount = discriminant < -EPS ? 0 : Math.abs(discriminant) < EPS ? 1 : 2;
      return (c) => {
        if (c === 'keine Lösung') return rootCount === 0;
        // „x₁ = −7, x₂ = 4“ bzw. „x = 9“: nur die Zahlen rechts der Gleichheitszeichen
        const values = c.split(', ').map((part) => numbers(part.split('=')[1])[0]);
        return new Set(values).size === rootCount && values.every((x) => close(f(x), 0));
      };
    }
    case 'k9-parabola-vertex': {
      const f = fn(prompt);
      const [a, b] = quadraticCoefficients(f);
      const xs = -b / (2 * a);
      return (c) => {
        const m = /S\((-?\d+) \\mid (-?\d+)\)/.exec(c);
        return !!m && close(Number(m[1]), xs) && close(Number(m[2]), f(xs));
      };
    }
    case 'k9-pythagoras': {
      const unit = / (m|cm),/.exec(prompt)![1];
      const n = numbers(prompt);
      if (instruction.includes('Kathete')) return (c) => quantityIs(c, Math.sqrt(n[0] ** 2 - n[1] ** 2), unit);
      const hyp = Math.hypot(n[0], n[1]);
      return instruction.includes('gerundet') ? (c) => roundedIs(c, hyp, 1, unit) : (c) => quantityIs(c, hyp, unit);
    }
    case 'k9-circle': {
      const [value] = numbers(prompt);
      const unit = / (m|cm)$/.exec(prompt)![1];
      const radius = prompt.includes('d =') ? value / 2 : value;
      return instruction.includes('Umfang') ? (c) => roundedIs(c, 2 * Math.PI * radius, 2, unit) : (c) => roundedIs(c, Math.PI * radius ** 2, 2, `${unit}²`);
    }
    case 'k10-growth': {
      if (instruction.includes('Prozent')) {
        const [from, to] = numbers(prompt.replace(/\u202f/g, ''));
        return (c) => quantityIs(c, ((to - from) / from) * 100, '%');
      }
      const years = numbers(instruction)[0];
      const [start, p] = numbers(prompt.replace(/\u202f/g, ''));
      if (instruction.includes('Geld')) return (c) => roundedIs(c, start * (1 + p / 100) ** years, 2, '€');
      return (c) => roundedIs(c, start * (1 - p / 100) ** years, 0, 'Tiere');
    }
    case 'k10-logarithm': {
      const m = /\\log_\{(\d+)\}\s*\((.+)\)\s*=\s*\?/.exec(clean(prompt))!;
      const value = Math.log(evaluateNumeric(m[2])) / Math.log(Number(m[1]));
      return (c) => close(evaluateNumeric(c), value);
    }
    case 'k10-trigonometry': {
      if (instruction.startsWith('Welcher Wert')) {
        const [, f, angle] = /\\(sin|cos|tan)\((\d+)\^\{\\circ\}\)/.exec(prompt)!;
        const value = Math[f as 'sin'](Number(angle) * (Math.PI / 180));
        return (c) => Math.abs(evaluateNumeric(c) - value) < 1e-9;
      }
      if (instruction.includes('Winkel')) {
        const [a, b] = numbers(prompt);
        return (c) => roundedIs(c, (Math.atan(a / b) * 180) / Math.PI, 1, '°');
      }
      const [hyp, alpha] = numbers(prompt);
      const side = instruction.includes('Gegenkathete') ? Math.sin((alpha * Math.PI) / 180) : Math.cos((alpha * Math.PI) / 180);
      return (c) => roundedIs(c, hyp * side, 1, 'cm');
    }
    case 'k10-solids': {
      const [rr, h] = numbers(prompt);
      if (prompt.startsWith('Kugel')) return (c) => roundedIs(c, (4 / 3) * Math.PI * rr ** 3, 1, 'cm³');
      if (prompt.startsWith('Kegel')) return (c) => roundedIs(c, (Math.PI * rr * rr * h) / 3, 1, 'cm³');
      if (instruction.includes('Oberfläche')) return (c) => roundedIs(c, 2 * Math.PI * rr * rr + 2 * Math.PI * rr * h, 1, 'cm²');
      return (c) => roundedIs(c, Math.PI * rr * rr * h, 1, 'cm³');
    }
  }
  const value = evaluateNumeric(leftOfQuestion(prompt));
  return (c) => close(evaluateNumeric(c), value);
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

describe('grade 8–10 generators', () => {
  it('cover every topic of grades 8–10', () => {
    expect(MIDDLE_TOPICS.filter((t) => !registry.has(t.id)).map((t) => t.id)).toEqual([]);
  });

  for (const topic of MIDDLE_TOPICS) {
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
