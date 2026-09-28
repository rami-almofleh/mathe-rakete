import { TOPICS } from '../../curriculum/curriculum';
import { Difficulty, Operation, Task } from '../../models';
import { Rng } from '../../math/rng';
import { ALL_GENERATORS, createDefaultRegistry } from '../all-generators';
import { TaskGenerator } from '../generator';
import { tryCreateTask } from '../task-factory';

/**
 * Massentest: Jede Aufgabe wird hier unabhängig vom Generator nachgerechnet –
 * aus dem angezeigten Text. Genau eine der 3 Antworten muss stimmen.
 */

const RUNS = 1000;
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const PRIMARY_TOPICS = TOPICS.filter((t) => t.grade <= 4);
// Bild-Aufgaben prüft figures.spec.ts
const PRIMARY_TEXT_TOPICS = PRIMARY_TOPICS.filter((t) => !t.figure);
const registry = createDefaultRegistry();

// ---- Unabhängiger Parser für die angezeigten Texte -------------------------------------

const NNBSP = / /g;

function parseNumber(text: string): number {
  return Number(text.replace(NNBSP, '').replace('−', '-').replace(',', '.'));
}

/** Rechnet eine Kette wie „3 + 4 · 5 − 2“ (Punkt vor Strich). */
function evaluate(expression: string): number {
  const tokens = expression.trim().split(' ').filter(Boolean);
  const values: number[] = [parseNumber(tokens[0])];
  const ops: string[] = [];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const n = parseNumber(tokens[i + 1]);
    if (op === '·') values.push(values.pop()! * n);
    else if (op === ':') values.push(values.pop()! / n);
    else {
      ops.push(op);
      values.push(n);
    }
  }
  return ops.reduce((acc, op, i) => (op === '+' ? acc + values[i + 1] : acc - values[i + 1]), values[0]);
}

/** Löst „links = rechts“ mit ? oder □ als Unbekannte. */
function solveEquation(text: string): number {
  const normalized = text.replace(NNBSP, '');
  const [left, right] = normalized.split(' = ');
  if (right === '?') {
    return evaluate(left);
  }
  const solutions: number[] = [];
  for (let x = 0; x <= 2000; x++) {
    if (evaluate(left.replace('□', String(x))) === parseNumber(right)) solutions.push(x);
  }
  if (solutions.length !== 1) throw new Error(`${text}: ${solutions.length} Lösungen`);
  return solutions[0];
}

const UNIT_FACTORS: Record<string, number> = {
  km: 1_000_000, m: 1000, cm: 10, mm: 1,
  kg: 1000, g: 1,
  h: 60, min: 1,
  '€': 100, ct: 1,
};

/** „2 kg 300 g“, „3,45 m“, „1 € 20 ct“ → Wert in der Basiseinheit. */
function parseQuantity(text: string): number {
  const re = /([\d ]+(?:,\d+)?) (km|kg|mm|cm|min|m|g|h|€|ct)(?![a-z])/g;
  let total = 0;
  let found = false;
  for (const match of text.matchAll(re)) {
    total += parseNumber(match[1]) * UNIT_FACTORS[match[2]];
    found = true;
  }
  if (!found) throw new Error(`Keine Größe in „${text}“`);
  return Math.round(total * 1000) / 1000;
}

function roundTo(n: number, place: number): number {
  return Math.round(n / place) * place;
}

const PLACES: Record<string, number> = { Zehner: 10, Hunderter: 100, Tausender: 1000 };

type Check = { expected: number; parse: (choice: string) => number };

/** Erwarteter Wert + wie die Antworten gelesen werden – je nach Aufgabenform. */
function independentCheck(task: Task): Check {
  const text = task.prompt.math.value;
  const instruction = task.prompt.instruction ?? '';

  if (task.topicId === 'k1-compare') {
    const [l, r] = text.split(' ○ ');
    const diff = evaluate(l) - evaluate(r);
    const symbols = ['<', '=', '>'];
    return { expected: Math.sign(diff), parse: (c) => symbols.indexOf(c) - 1 };
  }
  if (task.topicId === 'k1-double-half') {
    const m = text.match(/^(Das Doppelte|Die Hälfte) von (\S+) ist (\S+)$/)!;
    const factor = m[1] === 'Das Doppelte' ? 2 : 0.5;
    const expected = m[3] === '?' ? parseNumber(m[2]) * factor : parseNumber(m[3]) / factor;
    return { expected, parse: parseNumber };
  }
  if (task.topicId === 'k3-div-remainder') {
    const [dividend, divisor] = text.replace(' = ?', '').split(' : ').map(parseNumber);
    // „q Rest r“ ist nur richtig, wenn q · d + r = Dividend UND r < d
    return {
      expected: 1,
      parse: (c) => {
        const [q, r] = c.split(' Rest ').map(Number);
        return Number(q * divisor + r === dividend && r > 0 && r < divisor);
      },
    };
  }
  if (instruction.startsWith('Runde auf')) {
    const place = PLACES[instruction.split(' ')[2].replace('.', '')];
    return { expected: roundTo(parseNumber(text.replace(' ≈ ?', '')), place), parse: parseNumber };
  }
  if (instruction.startsWith('Überschlage')) {
    const place = PLACES[instruction.split(' ').at(-1)!.replace('.', '')];
    const [a, op, b] = text.replace(NNBSP, '').replace(' ≈ ?', '').split(' ');
    const rounded = `${roundTo(parseNumber(a), place)} ${op} ${roundTo(parseNumber(b), place)}`;
    return { expected: evaluate(rounded), parse: parseNumber };
  }
  if (/(km|kg|mm|cm|min|m|g|h|€|ct)\b/.test(text) || text.includes('€')) {
    const left = text.split(' = ')[0];
    const parts = left.split(/ ([+−]) /);
    let value = parseQuantity(parts[0]);
    for (let i = 1; i < parts.length; i += 2) {
      value += (parts[i] === '+' ? 1 : -1) * parseQuantity(parts[i + 1]);
    }
    return { expected: value, parse: parseQuantity };
  }
  return { expected: solveEquation(text), parse: parseNumber };
}

/** Größte erlaubte Zahl in Aufgabe und Antworten (Zahlenraum der Klasse). */
const NUMBER_RANGE: Record<string, number> = {
  'k1-add-10': 10, 'k1-sub-10': 10, 'k1-add-20': 20, 'k1-sub-20': 20, 'k1-missing': 20, 'k1-double-half': 20, 'k1-compare': 20,
  'k2-add-100': 100, 'k2-sub-100': 100, 'k2-times-table': 100, 'k2-div': 100,
  'k3-add-1000': 1000, 'k3-sub-1000': 1000, 'k3-times-tens': 1000, 'k3-div-remainder': 100,
};

function numbersIn(text: string): number[] {
  return [...text.replace(NNBSP, '').matchAll(/\d+(?:,\d+)?/g)].map((m) => parseNumber(m[0]));
}

function verify(task: Task): string | null {
  const choices = task.choices.map((c) => c.display.value);
  if (choices.some((c) => c.startsWith('−'))) return `negative Antwort: ${choices}`;
  if (!task.explanation?.length) return 'kein Lösungsweg';

  const range = NUMBER_RANGE[task.topicId];
  if (range !== undefined) {
    const numbers = [...numbersIn(task.prompt.math.value), ...choices.flatMap(numbersIn)];
    if (numbers.some((n) => n > range)) return `Zahl über ${range}: ${task.prompt.math.value} | ${choices}`;
  }

  const { expected, parse } = independentCheck(task);
  const matches = choices.map((c, i) => [parse(c), i] as const).filter(([v]) => Math.abs(v - expected) < 1e-9);
  if (matches.length !== 1) return `${matches.length} passende Antworten: ${task.prompt.math.value} → ${expected} | ${choices}`;
  if (matches[0][1] !== task.correctIndex) return `falscher correctIndex: ${task.prompt.math.value} | ${choices}`;
  return null;
}

function generate(generator: TaskGenerator, difficulty: Difficulty, seed: number, operations?: Operation[]): Task {
  const topic = TOPICS.find((t) => t.id === generator.topicId)!;
  const result = tryCreateTask(generator, { id: `${seed}`, grade: topic.grade, difficulty, rng: new Rng(seed), operations });
  if (!result.ok) throw new Error(`${generator.topicId}/${difficulty}/Seed ${seed}: ${result.problem}`);
  return result.task;
}

// ---- Tests ---------------------------------------------------------------------------------

describe('primary generators', () => {
  it('cover every topic of grades 1–4 exactly once', () => {
    const primaryIds = new Set(PRIMARY_TOPICS.map((t) => t.id));
    expect(ALL_GENERATORS.map((g) => g.topicId).filter((id) => primaryIds.has(id)).sort()).toEqual([...primaryIds].sort());
  });

  for (const topic of PRIMARY_TEXT_TOPICS) {
    for (const difficulty of DIFFICULTIES) {
      it(`${topic.id} (${difficulty}): ${RUNS} valid, independently verified tasks`, () => {
        const generator = registry.get(topic.id)!;
        const problems: string[] = [];
        const prompts = new Set<string>();
        for (let seed = 0; seed < RUNS && problems.length < 5; seed++) {
          try {
            const task = generate(generator, difficulty, seed);
            prompts.add(task.prompt.math.value);
            const problem = verify(task);
            if (problem) problems.push(`Seed ${seed}: ${problem}`);
          } catch (error) {
            problems.push((error as Error).message);
          }
        }
        expect(problems).toEqual([]);
        // genug Abwechslung
        expect(prompts.size).toBeGreaterThanOrEqual(8);
      });
    }
  }
});

describe('difficulty levels', () => {
  const tasks = (topicId: string, difficulty: Difficulty, operations?: Operation[]) =>
    Array.from({ length: 300 }, (_, seed) => generate(registry.get(topicId)!, difficulty, seed, operations));
  const operands = (t: Task) => numbersIn(t.prompt.math.value);

  it('k1-add-20: easy without, medium with crossing ten', () => {
    for (const t of tasks('k1-add-20', 'easy')) {
      const [a, b] = operands(t);
      expect((a % 10) + (b % 10)).toBeLessThan(10);
    }
    for (const t of tasks('k1-add-20', 'medium')) {
      const [a, b] = operands(t);
      expect(a + b).toBeGreaterThan(10);
    }
  });

  it('k2-add-100 hard always needs a carry', () => {
    for (const t of tasks('k2-add-100', 'hard')) {
      const [a, b] = operands(t);
      expect((a % 10) + (b % 10)).toBeGreaterThanOrEqual(10);
    }
  });

  it('k4-written-div hard has a zero inside the quotient', () => {
    for (const t of tasks('k4-written-div', 'hard')) {
      const [dividend, divisor] = operands(t);
      expect(String(dividend / divisor).slice(0, -1)).toContain('0');
    }
  });

  it('respects the selected operations', () => {
    for (const t of tasks('k1-missing', 'medium', ['sub'])) {
      expect(t.prompt.math.value).toContain('−');
      expect(t.prompt.math.value).not.toContain('+');
    }
    for (const t of tasks('k4-written-add-sub', 'hard', ['add'])) {
      expect(t.prompt.math.value).toContain('+');
    }
    for (const t of tasks('k2-money', 'hard', ['sub'])) {
      expect(t.prompt.math.value).toContain('−');
    }
  });
});
