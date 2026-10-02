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

  if (task.topicId.endsWith('-compare')) {
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
  if (task.topicId.endsWith('-place-value')) {
    // „3 HT + 13 Z + □ E = …“ → „3 · 100000 + 13 · 10 + □ · 1 = …“
    const values: Record<string, number> = { HT: 100_000, ZT: 10_000, T: 1000, H: 100, Z: 10, E: 1 };
    return { expected: solveEquation(text.replace(/(\d+|□) (HT|ZT|T|H|Z|E)\b/g, (_, n, p) => `${n} · ${values[p]}`)), parse: parseNumber };
  }
  if (task.topicId.endsWith('-neighbors')) {
    const named = text.match(/^Der (Nachfolger|Vorgänger) von (\S+) ist \?$/);
    if (named) return { expected: parseNumber(named[2]) + (named[1] === 'Nachfolger' ? 1 : -1), parse: parseNumber };
    if (instruction === 'Welche Zahl liegt dazwischen?' || instruction === 'Welche Zahl liegt genau in der Mitte?') {
      const [left, , right] = text.split(' < ').map(parseNumber);
      if (instruction === 'Welche Zahl liegt dazwischen?') expect(right - left).toBe(2);
      return { expected: (left + right) / 2, parse: parseNumber };
    }
    const place = instruction === 'Nachbarzehner' ? 10 : 100;
    const [left, middle, right] = text.split(' < ');
    const n = parseNumber(middle);
    // ? links: der kleinere Nachbar, ? rechts: der größere – und der gezeigte Nachbar muss stimmen
    if (left === '?') {
      expect(parseNumber(right)).toBe(Math.ceil(n / place) * place);
      return { expected: Math.floor(n / place) * place, parse: parseNumber };
    }
    expect(parseNumber(left)).toBe(Math.floor(n / place) * place);
    return { expected: Math.ceil(n / place) * place, parse: parseNumber };
  }
  if (task.topicId.endsWith('-time-span')) {
    const [, h1, m1, h2, m2] = text.match(/^(\d+):(\d+) Uhr → (\d+):(\d+) Uhr$/)!.map(Number);
    return { expected: h2 * 60 + m2 - (h1 * 60 + m1), parse: parseQuantity };
  }
  if (task.topicId.endsWith('-time-point')) {
    const [, h, m, sign, amount] = text.match(/^(\d+):(\d+) Uhr ([+−]) (.+) = \?$/)!;
    const delta = parseQuantity(amount) * (sign === '+' ? 1 : -1);
    return { expected: Number(h) * 60 + Number(m) + delta, parse: parseClock };
  }
  if (task.topicId.endsWith('-calendar')) {
    return calendarCheck(text);
  }
  if (task.topicId.endsWith('-scale')) {
    const scale = parseNumber(instruction.replace('Maßstab 1 : ', ''));
    const forward = text.match(/^Auf der Karte: (.+)\. In Wirklichkeit: \?$/);
    if (forward) return { expected: parseQuantity(forward[1]) * scale, parse: parseQuantity };
    const back = text.match(/^In Wirklichkeit: (.+)\. Auf der Karte: \?$/)!;
    return { expected: parseQuantity(back[1]) / scale, parse: (c) => (c.endsWith(' cm') ? parseQuantity(c) : NaN) };
  }
  if (task.topicId.endsWith('-rectangle')) {
    return rectangleCheck(text);
  }
  if (task.topicId.endsWith('-word-problems')) {
    return { expected: solveWordProblem(text), parse: (c) => parseNumber(c.replace(/ (€|m|kg)$/, '')) };
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

/** „9:15 Uhr“ → Minuten seit Mitternacht */
function parseClock(text: string): number {
  const m = text.match(/^(\d+):(\d{2}) Uhr$/);
  if (!m) throw new Error(`Keine Uhrzeit: ${text}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Kalender: Antwort als Index in der Liste (bzw. Tageszahl) nachrechnen */
function calendarCheck(text: string): Check {
  const cyc = (list: string[], from: string, steps: number) => {
    const i = list.indexOf(from);
    expect(i).toBeGreaterThanOrEqual(0);
    return { expected: (((i + steps) % list.length) + list.length) % list.length, parse: (c: string) => list.indexOf(c) };
  };
  let m = text.match(/^Welcher (Tag|Monat) kommt (nach|vor) (\S+)\?$/);
  if (m) return cyc(m[1] === 'Tag' ? WEEKDAYS : MONTHS, m[3], m[2] === 'nach' ? 1 : -1);
  m = text.match(/^Heute ist (\S+)\. Welcher Tag (ist in|war vor) (\d+) Tagen\?$/);
  if (m) return cyc(WEEKDAYS, m[1], Number(m[3]) * (m[2] === 'ist in' ? 1 : -1));
  m = text.match(/^Welcher Monat ist (\d+) Monate nach (\S+)\?$/);
  if (m) return cyc(MONTHS, m[2], Number(m[1]));
  m = text.match(/^Wie viele Tage hat der (\S+)\?$/);
  if (m) {
    expect(m[1]).not.toBe('Februar');
    return { expected: MONTH_DAYS[MONTHS.indexOf(m[1])], parse: parseNumber };
  }
  throw new Error(`Unbekannte Kalenderfrage: ${text}`);
}

/** Rechteck/Quadrat in Worten – Zahl UND Einheit (cm vs. cm²) müssen stimmen */
function rectangleCheck(text: string): Check {
  const withUnit = (value: number, unit: string) => ({
    expected: value,
    parse: (c: string) => (c.endsWith(` ${unit}`) ? parseNumber(c.slice(0, -unit.length - 1)) : NaN),
  });
  let m = text.match(/^Ein Rechteck ist (\d+) (cm|m) lang und (\d+) (?:cm|m) breit\. Wie (groß ist der Flächeninhalt|lang ist der Umfang)\?$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[3])];
    return m[4].includes('Fläche') ? withUnit(a * b, `${m[2]}²`) : withUnit(2 * (a + b), m[2]);
  }
  m = text.match(/^Ein Quadrat hat (\d+) (cm|m) lange Seiten\. Wie (groß ist der Flächeninhalt|lang ist der Umfang)\?$/);
  if (m) return m[3].includes('Fläche') ? withUnit(Number(m[1]) ** 2, `${m[2]}²`) : withUnit(4 * Number(m[1]), m[2]);
  m = text.match(/^Ein Rechteck ist (\d+) (cm|m) lang und hat einen (Flächeninhalt|Umfang) von (\d+) (?:cm|m)²?\. Wie breit ist es\?$/);
  if (m) {
    const [a, given] = [Number(m[1]), Number(m[4])];
    return withUnit(m[3] === 'Flächeninhalt' ? given / a : given / 2 - a, m[2]);
  }
  throw new Error(`Unbekannte Rechteck-Aufgabe: ${text}`);
}

/** Sachaufgabe: Rechnung aus den Signalwörtern des Textes ableiten (unabhängig von den Vorlagen im Code) */
function solveWordProblem(text: string): number {
  const n = numbersIn(text);
  const has = (...words: string[]) => words.every((w) => text.includes(w));
  if (has('dazu', 'verschenkt')) return n[0] + n[1] - n[2];
  if (has('dazu')) return n[0] + n[1];
  if (has('steigen', 'aus')) return n[0] - n[1];
  if (has('mehr als')) return n[0] - n[1];
  if (has('In einer Packung')) return n[0] * n[1];
  if (has('Gruppen zu je')) return n[0] / n[1];
  if (has('Rückgeld')) return n.length === 3 ? n[2] - n[0] * n[1] : n[1] - n[0];
  if (has('In jeder der')) return n[0] * n[1];
  if (has('gleichmäßig')) return n[0] / n[1];
  if (has('fehlen noch')) return n[0] - n[1];
  if (has('Besucher', 'zusammen')) return n[0] + n[1];
  if (has('Reihen mit je', 'verkauft')) return n[0] * n[1] - n[2];
  if (has('Reihen mit je')) return n[0] * n[1];
  if (has('Säcke zu je')) return n[0] / n[1];
  if (has('jeden Monat')) return n[0] * n[1];
  if (has('billiger')) return n[0] - n[1];
  if (has('wieder zurück')) return 2 * n[0] * n[1];
  throw new Error(`Unbekannte Sachaufgabe: ${text}`);
}

/** Größte erlaubte Zahl in Aufgabe und Antworten (Zahlenraum der Klasse). */
const NUMBER_RANGE: Record<string, number> = {
  'k1-add-10': 10, 'k1-sub-10': 10, 'k1-add-20': 20, 'k1-sub-20': 20, 'k1-missing': 20, 'k1-double-half': 20, 'k1-compare': 20,
  'k2-add-100': 100, 'k2-sub-100': 100, 'k2-times-table': 100, 'k2-div': 100,
  'k3-add-1000': 1000, 'k3-sub-1000': 1000, 'k3-times-tens': 1000, 'k3-div-remainder': 100,
  'k1-neighbors': 20,
  'k2-word-problems': 100, 'k3-word-problems': 1000, 'k4-word-problems': 1_000_000,
  'k2-place-value': 100, 'k2-neighbors': 100, 'k2-compare': 100, 'k2-complete': 100,
  'k4-place-value': 1_000_000, 'k4-compare': 1_000_000,
  'k3-place-value': 1000, 'k3-neighbors': 1000, 'k3-compare': 1000, 'k3-rounding': 1000, 'k3-complete': 1000, 'k3-div-halfwritten': 1000,
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

  it('rounding never offers 0 as an answer', () => {
    for (const id of ['k3-rounding', 'k4-rounding']) {
      for (const difficulty of DIFFICULTIES) {
        for (const t of tasks(id, difficulty)) expect(t.choices.map((c) => c.display.value)).not.toContain('0');
      }
    }
  });

  it('k3-complete easy fills up to the next hundred', () => {
    for (const t of tasks('k3-complete', 'easy')) {
      const [n, target] = operands(t);
      expect(target).toBe(Math.ceil(n / 100) * 100);
    }
  });

  it('k3-div-halfwritten hard needs regrouping (tens not divisible)', () => {
    for (const t of tasks('k3-div-halfwritten', 'hard')) {
      const [dividend, divisor] = operands(t);
      expect(Math.floor(dividend / 10) % divisor).not.toBe(0);
    }
  });

  it('k3-time-span medium crosses the full hour, hard takes more than an hour', () => {
    const minutes = (t: Task) => {
      const [h1, m1, h2, m2] = operands(t);
      return { crosses: h1 !== h2, duration: h2 * 60 + m2 - (h1 * 60 + m1) };
    };
    for (const t of tasks('k3-time-span', 'easy')) expect(minutes(t).crosses).toBe(false);
    for (const t of tasks('k3-time-span', 'medium')) expect(minutes(t)).toMatchObject({ crosses: true });
    for (const t of tasks('k3-time-span', 'hard')) expect(minutes(t).duration).toBeGreaterThan(60);
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
