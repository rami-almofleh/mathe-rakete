import { Rng } from '../../math/rng';
import { GeneratedTask } from '../generator';
import {
  addWithoutCarry,
  DIVIDED,
  explainAddition,
  explainSubtraction,
  explainTimesTable,
  expr,
  integerTask,
  MINUS,
  PLUS,
  subtractSmallerDigit,
  subtractWithoutBorrow,
  TIMES,
} from './helpers';

/**
 * Größte gemeinsame Stufenzahl: 40 + 50 → 10, 300 + 400 → 100, 47 + 8 → 1.
 * Bei „glatten“ Aufgaben verrechnen sich Kinder um eine ganze Stufe (80, 100) – nicht um 1.
 */
function commonUnit(a: number, b: number): number {
  let unit = 1;
  while (a % (unit * 10) === 0 && b % (unit * 10) === 0 && unit * 10 <= Math.max(a, b)) {
    unit *= 10;
  }
  return unit;
}

/** Stellenwertfehler: eine glatte Zehner-/Hunderterzahl wie Einer gerechnet (62 + 20 → 62 + 2). */
function placeValueSlips(a: number, b: number, op: (x: number, y: number) => number): number[] {
  const slips: number[] = [];
  if (b % 10 === 0 && b >= 10) slips.push(op(a, b / commonUnit(b, b)));
  if (a % 10 === 0 && a >= 10) slips.push(op(a / commonUnit(a, a), b));
  return slips;
}

/** „4 + 5 = 9, also 40 + 50 = 90“ */
function explainByAnalogy(a: number, op: string, b: number, result: number, unit: number): string[] {
  return [expr(a / unit, op, b / unit, '=', result / unit), `also ${expr(a, op, b, '=', result)}`];
}

function nearbyInUnits(value: number, unit: number): (rng: Rng) => number {
  return (rng) => value + rng.pick([1, 2, 3]) * unit * rng.sign();
}

/** a + b = ? */
export function additionTask(a: number, b: number, max?: number): GeneratedTask {
  const sum = a + b;
  const unit = commonUnit(a, b);
  if (unit > 1) {
    return integerTask({
      prompt: expr(a, PLUS, b, '=', '?'),
      answer: sum,
      // um eine Stufe verrechnet, Nullen vergessen, minus statt plus
      distractors: [sum + unit, sum - unit, sum / unit, ...(a !== b ? [Math.abs(a - b)] : [])],
      explanation: explainByAnalogy(a, PLUS, b, sum, unit),
      max,
      nearby: nearbyInUnits(sum, unit),
    });
  }
  return integerTask({
    prompt: expr(a, PLUS, b, '=', '?'),
    answer: sum,
    // verzählt, Zehner verrutscht, Übertrag vergessen, Zehnerzahl als Einer gerechnet (62 + 20 → 64),
    // minus statt plus (nicht bei a = b, sonst 0)
    distractors: [
      sum + 1,
      sum - 1,
      sum + 10,
      sum - 10,
      addWithoutCarry(a, b),
      ...placeValueSlips(a, b, (x, y) => x + y),
      ...(a !== b ? [Math.abs(a - b)] : []),
    ],
    explanation: explainAddition(a, b),
    max,
  });
}

/** a − b = ? */
export function subtractionTask(a: number, b: number, max?: number): GeneratedTask {
  const diff = a - b;
  const unit = commonUnit(a, b);
  // 10 − 10 = 0: Zehnerschritte ergäben nur negative Ablenker → normale Ablenker
  if (unit > 1 && diff >= unit) {
    return integerTask({
      prompt: expr(a, MINUS, b, '=', '?'),
      answer: diff,
      distractors: [diff + unit, diff - unit, diff / unit, a + b],
      explanation: explainByAnalogy(a, MINUS, b, diff, unit),
      max,
      nearby: nearbyInUnits(diff, unit),
    });
  }
  return integerTask({
    prompt: expr(a, MINUS, b, '=', '?'),
    answer: diff,
    distractors: [
      diff + 1,
      diff - 1,
      diff + 10,
      diff - 10,
      subtractSmallerDigit(a, b),
      subtractWithoutBorrow(a, b),
      ...placeValueSlips(a, b, (x, y) => x - y),
      a + b,
    ],
    explanation: explainSubtraction(a, b),
    max,
  });
}

/** a · b = ? (Einmaleins und Ähnliches) */
export function multiplicationTask(a: number, b: number, max?: number, explanation?: string[]): GeneratedTask {
  const product = a * b;
  return integerTask({
    prompt: expr(a, TIMES, b, '=', '?'),
    answer: product,
    // Nachbaraufgaben (eine Reihe verrutscht) und „plus statt mal“
    distractors: [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, a + b],
    explanation: explanation ?? explainTimesTable(a, b),
    max,
  });
}

/** a : b = ? (ohne Rest) */
export function divisionTask(dividend: number, divisor: number, max?: number): GeneratedTask {
  const quotient = dividend / divisor;
  if (!Number.isInteger(quotient)) {
    throw new RangeError(`${dividend} : ${divisor} geht nicht auf`);
  }
  return integerTask({
    prompt: expr(dividend, DIVIDED, divisor, '=', '?'),
    answer: quotient,
    distractors: [quotient + 1, quotient - 1, dividend - divisor, quotient * 10],
    explanation: [expr(dividend, DIVIDED, divisor, '=', quotient) + `, denn ${expr(quotient, TIMES, divisor, '=', dividend)}`],
    max,
  });
}
