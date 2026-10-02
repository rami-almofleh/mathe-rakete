import { plain } from '../../models';
import { Rng } from '../../math/rng';
import { textAnswer } from '../answers';
import { Answer, GeneratedTask } from '../generator';
import { expr, MINUS, PLUS } from './helpers';
import { formatMixed, unitTask, UNITS } from './units';

/**
 * Uhrzeiten als Minuten seit Mitternacht: Zeitspannen („Wie lange dauert es?“) und
 * Zeitpunkte („8:40 Uhr + 35 min = ?“) – die Stunde hat 60 Minuten, nicht 100.
 */

const sys = UNITS.hMin;

/** 520 → „8:40 Uhr“ */
export const clockText = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')} Uhr`;

/** „8:40 Uhr → 9:15 Uhr“, Antwort als Dauer („35 min“, „1 h 25 min“) */
export function timeSpanTask(start: number, duration: number): GeneratedTask {
  const end = start + duration;
  // Fehler „1 h = 100 min“: Uhrzeiten wie Dezimalzahlen abgezogen (9:05 − 7:40 → 165)
  const decimalError = Math.floor(end / 60) * 100 + (end % 60) - (Math.floor(start / 60) * 100 + (start % 60));
  // Rechenweg in Etappen: bis zur nächsten vollen Stunde, ganze Stunden, Rest-Minuten
  const marks = [start];
  if (start % 60) marks.push(Math.min(start - (start % 60) + 60, end));
  if (Math.floor(end / 60) * 60 > marks.at(-1)!) marks.push(Math.floor(end / 60) * 60);
  if (end > marks.at(-1)!) marks.push(end);
  const legs = marks.slice(1).map((to, i) => `${clockText(marks[i])} bis ${clockText(to)}: ${formatMixed(to - marks[i], sys)}`);
  const explanation =
    Math.floor(end / 60) === Math.floor(start / 60)
      ? [`${clockText(start)} bis ${clockText(end)}: ${expr(end % 60, MINUS, start % 60, '=', duration)} min`]
      : [...legs, `Zusammen: ${formatMixed(duration, sys)}`];
  return unitTask({
    instruction: 'Wie lange dauert es?',
    prompt: `${clockText(start)} → ${clockText(end)}`,
    sys,
    answer: duration,
    distractors: [decimalError, duration + 60, duration - 60, duration + 5, duration - 5, duration + 10].filter((v) => v > 0),
    display: (t) => formatMixed(t.num / t.den, sys),
    explanation,
  });
}

const clockAnswer = (minutes: number): Answer => textAnswer(plain(clockText(minutes)), `clock:${minutes}`);

/** „8:40 Uhr + 35 min = ?“ bzw. „9:05 Uhr − 20 min = ?“ (`delta` negativ = zurück) */
export function timePointTask(start: number, delta: number): GeneratedTask {
  const end = start + delta;
  const forward = delta > 0;
  const amount = Math.abs(delta);
  // Rechenweg: erst die vollen Stunden, dann bis zur vollen Stunde, dann den Rest
  const explanation: string[] = [];
  let at = start;
  const hours = Math.floor(amount / 60) * 60;
  if (hours) {
    explanation.push(`${clockText(at)} ${forward ? PLUS : MINUS} ${formatMixed(hours, sys)} = ${clockText(at + (forward ? hours : -hours))}`);
    at += forward ? hours : -hours;
  }
  const rest = amount - hours;
  const toHour = forward ? 60 - (at % 60) : at % 60 || 60;
  if (rest > toHour) {
    const hourMark = forward ? at + toHour : at - toHour;
    explanation.push(`${clockText(at)} ${forward ? PLUS : MINUS} ${toHour} min = ${clockText(hourMark)}`);
    explanation.push(`${clockText(hourMark)} ${forward ? PLUS : MINUS} ${rest - toHour} min = ${clockText(end)}`);
  } else if (rest) {
    explanation.push(`${clockText(at)} ${forward ? PLUS : MINUS} ${rest} min = ${clockText(end)}`);
  }
  const sameHour = Math.floor(start / 60) * 60 + (end % 60); // Stunde nicht weitergezählt
  return {
    prompt: { math: plain(`${clockText(start)} ${forward ? PLUS : MINUS} ${formatMixed(amount, sys)} = ?`) },
    answer: clockAnswer(end),
    distractors: [sameHour, end + 60, end - 60, end + 5, end - 5, start - delta].filter((m) => m !== end && m > 0 && m < 24 * 60).map(clockAnswer),
    fallback: (rng: Rng) => clockAnswer(end + rng.pick([-15, -10, 10, 15])),
    explanation: explanation.map(plain),
  };
}
