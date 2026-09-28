import katex from 'katex';
import { TOPICS } from '../../curriculum/curriculum';
import { Difficulty, MathContent, Operation, Task } from '../../models';
import { Rational } from '../../math/rational';
import { Rng } from '../../math/rng';
import { createDefaultRegistry } from '../all-generators';
import { tryCreateTask } from '../task-factory';
import { evaluateFormula, leftOfQuestion, normalizeFormula, parseQuantity } from '../testing/formula-parser';

/**
 * Massentest Kl. 5–7: Jede Aufgabe wird aus dem angezeigten Text unabhängig nachgerechnet.
 * Genau eine der drei Antworten muss richtig sein – und zwar die an `correctIndex`.
 */

const RUNS = 600;
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const LOWER_TOPICS = TOPICS.filter((t) => t.grade >= 5 && t.grade <= 7 && !t.figure); // Bild-Aufgaben: figures.spec.ts
const registry = createDefaultRegistry();

// ---- kleine, unabhängige Hilfen ------------------------------------------------------------

const num = (text: string) => Number(normalizeFormula(text).replace(',', '.'));
const numbers = (text: string) => [...normalizeFormula(text).matchAll(/-?\d+(?:,\d+)?/g)].map((m) => Number(m[0].replace(',', '.')));
const gcdOf = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcdOf(b, a % b));
const isPrimeNumber = (n: number) => n > 1 && Array.from({ length: Math.floor(Math.sqrt(n)) - 1 }, (_, i) => i + 2).every((d) => n % d !== 0);
const sameText = (a: string, b: string) => a.replace(/\u202f/g, '') === b.replace(/\u202f/g, '');
const fractionOf = (choice: string) => /\\frac\{(\d+)\}\{(\d+)\}/.exec(choice);
const eq = (a: Rational, b: Rational | number) => a.equals(Rational.from(b));
const quantityIs = (choice: string, value: number | Rational, unit: string) => {
  const q = parseQuantity(choice);
  return q.unit === unit && eq(q.value, value);
};

type Judge = (choice: string) => boolean;

function judgeFor(task: Task): Judge {
  const prompt = task.prompt.math.value;
  const instruction = task.prompt.instruction ?? '';

  switch (task.topicId) {
    case 'k5-laws':
      if (instruction.startsWith('Welches Rechengesetz')) {
        const [left, right] = prompt.split(' = ');
        expect(evaluateFormula(left).equals(evaluateFormula(right))).toBe(true); // die Gleichung stimmt
        const law = left.includes('(') && right.includes('(') ? 'Assoziativgesetz' : left.includes('(') ? 'Distributivgesetz' : 'Kommutativgesetz';
        return (c) => c === law;
      }
      break;
    case 'k5-powers':
      if (prompt.includes('□')) {
        const target = num(prompt.split(' = ')[1]);
        return (c) => num(c) ** 2 === target;
      }
      break;
    case 'k5-divisibility': {
      const label = prompt.replace('?', '');
      const test = label === 'eine Primzahl' ? isPrimeNumber : (n: number) => n % Number(/durch (\d+)/.exec(label)![1]) === 0;
      return (c) => test(num(c));
    }
    case 'k5-rectangle': {
      const side = /a = (\d+) (\w+)/.exec(prompt)!;
      const a = Number(side[1]);
      const unit = side[2];
      if (prompt.startsWith('Rechteck: A =')) {
        const area = Number(/A = (\d+)/.exec(prompt)![1]);
        return (c) => quantityIs(c, area / a, unit);
      }
      if (prompt.startsWith('Rechteck: U =')) {
        const u = Number(/U = (\d+)/.exec(prompt)![1]);
        return (c) => quantityIs(c, u / 2 - a, unit);
      }
      const b = prompt.startsWith('Quadrat') ? a : Number(/b = (\d+)/.exec(prompt)![1]);
      return instruction.includes('Flächeninhalt') ? (c) => quantityIs(c, a * b, `${unit}²`) : (c) => quantityIs(c, 2 * (a + b), unit);
    }
    case 'k5-fraction-of': {
      const m = /\\tfrac\{(\d+)\}\{(\d+)\} \\text\{ von \} (.+) = \\;\?/.exec(prompt)!;
      const part = Rational.of(Number(m[1]), Number(m[2]));
      const units: Record<string, [number, string]> = { h: [60, 'min'], kg: [1000, 'g'], km: [1000, 'm'], m: [100, 'cm'], Euro: [100, 'ct'] };
      const unitMatch = /\\text\{(.+)\}/.exec(m[3]);
      if (unitMatch) {
        const [factor, small] = units[unitMatch[1]];
        return (c) => quantityIs(c, part.mul(factor), small);
      }
      return (c) => eq(evaluateFormula(c), part.mul(evaluateFormula(m[3])));
    }
    case 'k6-fraction-simplify': {
      const value = (c: string) => {
        const f = fractionOf(c);
        return f ? Rational.of(Number(f[1]), Number(f[2])) : evaluateFormula(c);
      };
      if (instruction.startsWith('Welcher Bruch ist am größten')) {
        return (c) => task.choices.every((o) => value(c).compare(value(o.display.value)) >= 0);
      }
      const given = evaluateFormula(prompt);
      if (instruction.startsWith('Kürze')) {
        return (c) => {
          const f = fractionOf(c)!;
          return eq(value(c), given) && gcdOf(Number(f[1]), Number(f[2])) === 1;
        };
      }
      if (instruction.startsWith('Erweitere')) {
        const target = Number(/Nenner (\d+)/.exec(instruction)![1]);
        return (c) => eq(value(c), given) && Number(fractionOf(c)![2]) === target;
      }
      return (c) => eq(value(c), given);
    }
    case 'k6-gcd-lcm': {
      const [, kind, a, b] = /(ggT|kgV)\((\d+), (\d+)\)/.exec(prompt)!;
      const g = gcdOf(Number(a), Number(b));
      const expected = kind === 'ggT' ? g : (Number(a) * Number(b)) / g;
      return (c) => num(c) === expected;
    }
    case 'k6-convert': {
      const given = prompt.endsWith('%') ? evaluateFormula(prompt.replace(' %', '')).div(100) : evaluateFormula(prompt);
      if (instruction.includes('Prozent')) return (c) => c.endsWith(' %') && eq(evaluateFormula(c.replace(' %', '')).div(100), given);
      if (instruction.includes('Bruch')) {
        return (c) => {
          const f = fractionOf(c);
          return !!f && gcdOf(Number(f[1]), Number(f[2])) === 1 && eq(evaluateFormula(c), given);
        };
      }
      return (c) => !c.includes('%') && !c.includes('frac') && eq(evaluateFormula(c), given);
    }
    case 'k6-cuboid': {
      if (prompt.startsWith('Aquarium')) {
        const [a, b, c] = numbers(prompt);
        return (x) => quantityIs(x, (a * b * c) / 1000, 'l');
      }
      const unit = /a = \d+ (\w+)/.exec(prompt)![1];
      const [a, b, c] = prompt.startsWith('Würfel') ? Array(3).fill(numbers(prompt)[0]) : numbers(prompt);
      return instruction.includes('Volumen')
        ? (x) => quantityIs(x, a * b * c, `${unit}³`)
        : (x) => quantityIs(x, 2 * (a * b + a * c + b * c), `${unit}²`);
    }
    case 'k7-percent': {
      let m = /^(\d+) % von (.+) = \?$/.exec(prompt);
      if (m) return (c) => eq(evaluateFormula(c), (num(m![2]) * Number(m![1])) / 100);
      m = /^(.+) von (.+) sind \? %$/.exec(prompt);
      if (m) return (c) => quantityIs(c, (num(m![1]) / num(m![2])) * 100, '%');
      m = /^(.+) sind (\d+) % von \?$/.exec(prompt)!;
      return (c) => eq(evaluateFormula(c), (num(m![1]) * 100) / Number(m![2]));
    }
    case 'k7-interest': {
      const [k, p, months = 12] = numbers(prompt);
      const interest = Rational.of(k * p * months, 1200);
      return instruction.includes('Konto') ? (c) => quantityIs(c, interest.add(k), '€') : (c) => quantityIs(c, interest, '€');
    }
    case 'k7-rule-of-three': {
      const [n1, v1] = numbers(instruction);
      const [n2] = numbers(prompt);
      const unit = prompt.startsWith('Wie lange') ? /in \d+ (\w+)\./.exec(instruction)![1].replace('Tagen', 'Tage') : /kosten/.test(instruction) ? '€' : 'km';
      const expected = prompt.startsWith('Wie lange') ? Rational.of(v1 * n1, n2) : Rational.of(Math.round(v1 * 100), 100).mul(Rational.of(n2, n1));
      return (c) => quantityIs(c, expected, unit);
    }
    case 'k7-terms': {
      const points = [{ x: 2, a: 3, b: -1 }, { x: -3, a: 5, b: 2 }, { x: 7, a: -2, b: 4 }];
      return (c) => points.every((p) => evaluateFormula(prompt, p).equals(evaluateFormula(c, p)));
    }
    case 'k7-linear-equations': {
      const [left, right] = prompt.split(' = ');
      return (c) => {
        const x = evaluateFormula(c.replace('x = ', ''));
        if (!x.isInteger()) return false;
        return evaluateFormula(left, { x: x.num }).equals(evaluateFormula(right, { x: x.num }));
      };
    }
    case 'k7-triangle-angles': {
      const n = numbers(prompt);
      let expected: number;
      if (prompt.startsWith('Dreieck')) expected = 180 - n[0] - n[1];
      else if (prompt.includes('Basiswinkel')) expected = 180 - 2 * n[0];
      else if (prompt.includes('Spitze')) expected = (180 - n[0]) / 2;
      else if (prompt.startsWith('Rechtwinkliges')) expected = 180 - 90 - n[1];
      else expected = instruction.includes('Nebenwinkel') ? 180 - n[0] : n[0];
      return (c) => c === `${expected}°`;
    }
    case 'k7-mean-median': {
      const xs = prompt.split('; ').map(Number);
      const sorted = [...xs].sort((a, b) => a - b);
      const mid = sorted.length / 2;
      const expected = instruction.includes('Mittelwert')
        ? Rational.of(xs.reduce((a, b) => a + b, 0), xs.length)
        : instruction.includes('Spannweite')
          ? Rational.of(sorted.at(-1)! - sorted[0])
          : sorted.length % 2
            ? Rational.of(sorted[Math.floor(mid)])
            : Rational.of(sorted[mid - 1] + sorted[mid], 2);
      return (c) => eq(evaluateFormula(c), expected);
    }
  }
  // reine Rechenaufgaben: „… = ?“
  const expected = evaluateFormula(leftOfQuestion(prompt));
  return (c) => eq(evaluateFormula(c), expected);
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
  if (task.grade < 7 && choices.some((c) => normalizeFormula(c).startsWith('-'))) return `negative Zahl vor Kl. 7: ${choices}`;

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

function generate(topicId: string, difficulty: Difficulty, seed: number, operations?: Operation[]): Task {
  const topic = TOPICS.find((t) => t.id === topicId)!;
  const result = tryCreateTask(registry.get(topicId)!, { id: `${seed}`, grade: topic.grade, difficulty, rng: new Rng(seed), operations });
  if (!result.ok) throw new Error(`${topicId}/${difficulty}/Seed ${seed}: ${result.problem}`);
  return result.task;
}

describe('grade 5–7 generators', () => {
  it('cover every topic of grades 5–7', () => {
    expect(LOWER_TOPICS.filter((t) => !registry.has(t.id)).map((t) => t.id)).toEqual([]);
  });

  for (const topic of LOWER_TOPICS) {
    for (const difficulty of DIFFICULTIES) {
      it(`${topic.id} (${difficulty}): ${RUNS} valid, independently verified tasks`, () => {
        const problems: string[] = [];
        const prompts = new Set<string>();
        for (let seed = 0; seed < RUNS && problems.length < 5; seed++) {
          try {
            const task = generate(topic.id, difficulty, seed);
            prompts.add([task.prompt.instruction, task.prompt.math.value, ...task.choices.map((c) => c.display.value).sort()].join('|'));
            const problem = verify(task);
            if (problem) problems.push(`Seed ${seed}: ${problem}`);
          } catch (error) {
            problems.push((error as Error).message);
          }
        }
        expect(problems).toEqual([]);
        expect(prompts.size).toBeGreaterThanOrEqual(8);
      });
    }
  }

  it('respects the selected operations', () => {
    const only = (topicId: string, op: Operation, symbol: RegExp, forbidden: RegExp) => {
      for (let seed = 0; seed < 200; seed++) {
        for (const d of DIFFICULTIES) {
          const prompt = generate(topicId, d, seed, [op]).prompt.math.value;
          expect(prompt, prompt).toMatch(symbol);
          expect(prompt, prompt).not.toMatch(forbidden);
        }
      }
    };
    only('k5-order-of-ops', 'add', /\+/, /[·:−]/);
    only('k5-order-of-ops', 'div', /:/, /[+·−]/);
    only('k6-fraction-add-sub', 'sub', /-/, /\+/);
    only('k6-decimal-mul-div', 'mul', /·/, /:/);
    only('k7-integers', 'mul', /·/, /[+:]| − /);
  });
});
