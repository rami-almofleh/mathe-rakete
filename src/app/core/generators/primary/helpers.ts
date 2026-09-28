import { Operation, plain } from '../../models';
import { formatInteger } from '../../math/format';
import { Rational } from '../../math/rational';
import { Rng } from '../../math/rng';
import { nearbyValue, numberAnswer } from '../answers';
import { Answer, GeneratedTask } from '../generator';

export { byDifficulty, generator, pickOperation, sample } from '../task-helpers';

export const PLUS = '+';
export const MINUS = '−';
export const TIMES = '·';
export const DIVIDED = ':';
/** Platzhalter in Aufgaben wie 3 + □ = 9. */
export const BOX = '□';

const SYMBOLS: Record<Operation, string> = { add: PLUS, sub: MINUS, mul: TIMES, div: DIVIDED };

export function symbol(op: Operation): string {
  return SYMBOLS[op];
}

/** Baut eine Aufgabenzeile: `expr(47, '+', 38, '=', '?')` → „47 + 38 = ?“ (Zahlen deutsch formatiert). */
export function expr(...parts: (number | string)[]): string {
  return parts.map((p) => (typeof p === 'number' ? formatInteger(p) : p)).join(' ');
}





export function digitsOf(n: number): number[] {
  return String(Math.abs(n)).split('').map(Number);
}

/** Zahl mit genau `count` Stellen. */
export function withDigits(rng: Rng, count: number): number {
  return rng.int(10 ** (count - 1), 10 ** count - 1);
}

/** Stellenwerte, z. B. 278 → [200, 70, 8] (Nullen fallen weg). */
export function placeParts(n: number): number[] {
  const digits = digitsOf(n);
  return digits.map((d, i) => d * 10 ** (digits.length - 1 - i)).filter((p) => p !== 0);
}

/** Spaltenweise Rechnung von rechts nach links; `column` bekommt Ziffern und Übertrag. */
function columnwise(
  a: number,
  b: number,
  column: (da: number, db: number, carry: number) => { digit: number; carry: number },
): { result: number; carries: number } {
  let result = 0;
  let carry = 0;
  let carries = 0;
  for (let place = 1; place <= Math.max(a, b) || carry; place *= 10) {
    const da = Math.floor(a / place) % 10;
    const db = Math.floor(b / place) % 10;
    const step = column(da, db, carry);
    result += step.digit * place;
    carry = step.carry;
    if (carry) carries++;
  }
  return { result, carries };
}

/** Anzahl Überträge bei der schriftlichen Addition. */
export function carryCount(a: number, b: number): number {
  return columnwise(a, b, (da, db, c) => ({ digit: (da + db + c) % 10, carry: da + db + c >= 10 ? 1 : 0 })).carries;
}

/** Anzahl Entbündelungen bei der schriftlichen Subtraktion (a ≥ b). */
export function borrowCount(a: number, b: number): number {
  if (a < b) {
    // sonst bliebe der Übertrag für immer stehen
    throw new RangeError(`${a} − ${b}: Minuend ist kleiner als Subtrahend`);
  }
  return columnwise(a, b, (da, db, c) => ({ digit: (da - db - c + 10) % 10, carry: da - db - c < 0 ? 1 : 0 })).carries;
}

// ---- Typische Fehler -------------------------------------------------------

/** Fehler „Übertrag vergessen“: 47 + 38 → 75. */
export function addWithoutCarry(a: number, b: number): number {
  return columnwise(a, b, (da, db) => ({ digit: (da + db) % 10, carry: 0 })).result;
}

/** Fehler „kleinere von größerer Ziffer“: 82 − 45 → 43. */
export function subtractSmallerDigit(a: number, b: number): number {
  return columnwise(a, b, (da, db) => ({ digit: Math.abs(da - db), carry: 0 })).result;
}

/** Fehler „Entbündeln vergessen“: 82 − 45 → 47 (Zehner nicht verringert). */
export function subtractWithoutBorrow(a: number, b: number): number {
  return columnwise(a, b, (da, db) => ({ digit: (da - db + 10) % 10, carry: 0 })).result;
}

/** Fehler „Übertrag beim Malnehmen vergessen“: 347 · 6 → 842 (nur Einerziffern). */
export function multiplyWithoutCarry(a: number, digit: number): number {
  return Number(digitsOf(a).map((d) => (d * digit) % 10).join(''));
}

// ---- Lösungswege -----------------------------------------------------------

/** Rechenweg Addition: bis zum nächsten Zehner auffüllen bzw. schrittweise nach Stellenwerten. */
export function explainAddition(a: number, b: number): string[] {
  const sum = a + b;
  if (b < 10) {
    const toTen = 10 - (a % 10);
    if (a % 10 !== 0 && b > toTen) {
      return [expr(a, PLUS, b, '=', a, PLUS, toTen, PLUS, b - toTen), expr(a + toTen, PLUS, b - toTen, '=', sum)];
    }
    return [expr(a, PLUS, b, '=', sum)];
  }
  const parts = placeParts(b);
  if (parts.length === 1) {
    return [expr(a, PLUS, b, '=', sum)];
  }
  const lines = [expr(a, PLUS, b, '=', a, ...parts.flatMap((p) => [PLUS, p]))];
  let running = a;
  for (const p of parts) {
    lines.push(expr(running, PLUS, p, '=', running + p));
    running += p;
  }
  return lines;
}

/** Rechenweg Subtraktion: bis zum Zehner zurück bzw. schrittweise nach Stellenwerten. */
export function explainSubtraction(a: number, b: number): string[] {
  const diff = a - b;
  if (b < 10) {
    const toTen = a % 10;
    if (toTen !== 0 && b > toTen) {
      return [expr(a, MINUS, b, '=', a, MINUS, toTen, MINUS, b - toTen), expr(a - toTen, MINUS, b - toTen, '=', diff)];
    }
    return [expr(a, MINUS, b, '=', diff)];
  }
  const parts = placeParts(b);
  if (parts.length === 1) {
    return [expr(a, MINUS, b, '=', diff)];
  }
  const lines = [expr(a, MINUS, b, '=', a, ...parts.flatMap((p) => [MINUS, p]))];
  let running = a;
  for (const p of parts) {
    lines.push(expr(running, MINUS, p, '=', running - p));
    running -= p;
  }
  return lines;
}

/** Rechenweg Einmaleins: kleine Aufgaben als Plus-Kette, sonst über die 5er-Kernaufgabe. */
export function explainTimesTable(a: number, b: number): string[] {
  const product = a * b;
  if (a === 1 || a === 5 || a === 10 || b === 1) {
    return [expr(a, TIMES, b, '=', product)];
  }
  if (a <= 4) {
    return [expr(a, TIMES, b, '=', ...Array.from({ length: a }, () => b).flatMap((x, i) => (i ? [PLUS, x] : [x])), '=', product)];
  }
  const core = 5;
  const rest = a - core;
  return [
    expr(a, TIMES, b, '=', core, TIMES, b, PLUS, rest, TIMES, b),
    expr(core * b, PLUS, rest * b, '=', product),
  ];
}

// ---- Aufgaben mit ganzzahliger Lösung ---------------------------------------

export interface IntegerTaskOptions {
  readonly prompt: string;
  readonly instruction?: string;
  readonly answer: number;
  /** Ergebnisse typischer Fehler; ungültige (negativ, zu groß, = Lösung) werden aussortiert. */
  readonly distractors: readonly number[];
  readonly explanation?: readonly string[];
  /** Größter erlaubter Wert im Zahlenraum des Themas. */
  readonly max?: number;
  /** Darstellung der Zahl, z. B. mit Einheit „240 cm“. */
  readonly format?: (n: number) => Answer;
  /** Eigener Auffüller; Standard sind Nachbarwerte (±1, ±2, ±10 …). */
  readonly nearby?: (rng: Rng) => number;
}

/** Aufgabe mit ganzer, nicht-negativer Lösung – der Normalfall in der Grundschule. */
export function integerTask(options: IntegerTaskOptions): GeneratedTask {
  const { answer, max = Number.MAX_SAFE_INTEGER } = options;
  const format = options.format ?? ((n: number) => numberAnswer(n));
  const valid = (n: number) => Number.isInteger(n) && n >= 0 && n <= max && n !== answer;
  const nearby = options.nearby ?? ((rng: Rng) => nearbyValue(Rational.of(answer), rng).num);

  return {
    prompt: { instruction: options.instruction, math: plain(options.prompt) },
    answer: format(answer),
    distractors: [...new Set(options.distractors)].filter(valid).map(format),
    fallback: (rng) => {
      const n = nearby(rng);
      if (!valid(n)) {
        throw new RangeError(`${n} passt nicht in den Zahlenraum`);
      }
      return format(n);
    },
    explanation: options.explanation?.map(plain),
  };
}
