import { plain } from '../../models';
import { formatDecimal, formatInteger, formatRounded } from '../../math/format';
import { Rational } from '../../math/rational';
import { Rng } from '../../math/rng';
import { textAnswer } from '../answers';
import { Answer, GeneratedTask } from '../generator';
import { TIMES } from './helpers';

export interface UnitSystem {
  readonly big: string;
  readonly small: string;
  /** Wie viele kleine Einheiten eine große ergibt. */
  readonly factor: number;
}

export const UNITS = {
  mCm: { big: 'm', small: 'cm', factor: 100 },
  cmMm: { big: 'cm', small: 'mm', factor: 10 },
  kmM: { big: 'km', small: 'm', factor: 1000 },
  kgG: { big: 'kg', small: 'g', factor: 1000 },
  hMin: { big: 'h', small: 'min', factor: 60 },
  euroCt: { big: '€', small: 'ct', factor: 100 },
} as const satisfies Record<string, UnitSystem>;

/** Systeme mit Zehner-Faktor – nur die haben eine Kommaschreibweise (3,45 m). */
export const DECIMAL_UNITS: readonly UnitSystem[] = [UNITS.euroCt, UNITS.mCm, UNITS.kgG, UNITS.kmM];

// ---- Darstellung -------------------------------------------------------------

/** „240 cm“ */
export function formatSmall(total: number, sys: UnitSystem): string {
  return `${formatInteger(total)} ${sys.small}`;
}

/** „2 m 40 cm“, „2 m“ oder „40 cm“ */
export function formatMixed(total: number, sys: UnitSystem): string {
  const big = Math.floor(total / sys.factor);
  const small = total % sys.factor;
  const parts = [];
  if (big) parts.push(`${formatInteger(big)} ${sys.big}`);
  if (small || !big) parts.push(`${formatInteger(small)} ${sys.small}`);
  return parts.join(' ');
}

/** „3,45 m“ bzw. „3,50 €“ (Gesamtwert in kleinen Einheiten, darf selbst ein Bruch sein) */
export function formatComma(total: Rational, sys: UnitSystem): string {
  const value = total.div(sys.factor);
  if (sys === UNITS.euroCt) {
    // Geld immer mit zwei Nachkommastellen; Bruchteile von Cent gibt es nicht
    const places = value.decimalPlaces();
    if (places === null || places > 2) {
      throw new RangeError('Kein gültiger Geldbetrag');
    }
    return `${formatRounded(value, 2)} ${sys.big}`;
  }
  return `${formatDecimal(value)} ${sys.big}`;
}

/** Nachkommastellen der Kommaschreibweise, z. B. m/cm → 2, kg/g → 3. */
function commaPlaces(sys: UnitSystem): number {
  return Math.round(Math.log10(sys.factor));
}

// ---- Aufgabe mit Größen-Antwort ---------------------------------------------------

export interface UnitTaskOptions {
  readonly prompt: string;
  readonly instruction?: string;
  readonly sys: UnitSystem;
  /** Lösung als Gesamtwert in der kleinen Einheit. */
  readonly answer: number;
  readonly distractors: readonly (number | Rational)[];
  readonly display: (total: Rational) => string;
  readonly explanation: readonly string[];
}

export function unitTask(options: UnitTaskOptions): GeneratedTask {
  const { sys, display } = options;
  const answerTotal = Rational.of(options.answer);
  const toAnswer = (total: Rational): Answer => textAnswer(plain(display(total)), `${sys.small}:${total.key()}`);
  const valid = (t: Rational) => t.sign > 0 && !t.equals(answerTotal);
  const candidates = options.distractors
    .filter((d) => d instanceof Rational || Number.isInteger(d))
    .map((d) => Rational.from(d))
    .filter(valid);

  const answers: Answer[] = [];
  for (const total of candidates) {
    try {
      answers.push(toAnswer(total));
    } catch {
      // nicht darstellbar (z. B. unendlicher Dezimalbruch)
    }
  }

  return {
    prompt: { instruction: options.instruction, math: plain(options.prompt) },
    answer: toAnswer(answerTotal),
    distractors: answers,
    fallback: (rng) => {
      const step = rng.pick([sys.factor, sys.factor / 10, 1].filter((s) => Number.isInteger(s) && s > 0));
      const total = answerTotal.add(step * rng.sign());
      if (!valid(total)) {
        throw new RangeError('ungültiger Nachbarwert');
      }
      return toAnswer(total);
    },
    explanation: options.explanation.map(plain),
  };
}

// ---- Umrechnungs-Aufgaben -------------------------------------------------------

/** „3 m = ? cm“ */
export function bigToSmall(sys: UnitSystem, rng: Rng, maxBig: number): GeneratedTask {
  const n = rng.int(2, maxBig);
  const total = n * sys.factor;
  return unitTask({
    prompt: `${formatInteger(n)} ${sys.big} = ? ${sys.small}`,
    sys,
    answer: total,
    distractors: [total * 10, total / 10, n * 10, n * 100, n * 1000].filter(Number.isInteger),
    display: (t) => formatSmall(t.num / t.den, sys),
    explanation: [
      `1 ${sys.big} = ${formatSmall(sys.factor, sys)}`,
      `${formatInteger(n)} ${sys.big} = ${formatInteger(n)} ${TIMES} ${formatSmall(sys.factor, sys)} = ${formatSmall(total, sys)}`,
    ],
  });
}

/** „300 cm = ? m“ */
export function smallToBig(sys: UnitSystem, rng: Rng, maxBig: number): GeneratedTask {
  const n = rng.int(2, maxBig);
  const total = n * sys.factor;
  return unitTask({
    prompt: `${formatSmall(total, sys)} = ? ${sys.big}`,
    sys,
    answer: total,
    // „300 m“ (Einheit getauscht, Zahl abgeschrieben), Faktor 10 daneben, ±1
    distractors: [total * sys.factor, n * 10 * sys.factor, (n + 1) * sys.factor, (n - 1) * sys.factor],
    display: (t) => `${formatInteger(t.num / t.den / sys.factor)} ${sys.big}`,
    explanation: [`${formatSmall(sys.factor, sys)} = 1 ${sys.big}`, `${formatSmall(total, sys)} = ${formatInteger(n)} ${sys.big}`],
  });
}

function randomMixed(sys: UnitSystem, rng: Rng, maxBig: number, roundSmall: boolean): { big: number; small: number; total: number } {
  const big = rng.int(1, maxBig);
  // „2 kg 300 g“ ist leichter als „2 kg 30 g“, „1 h 25 min“ leichter als „1 h 37 min“
  const roundStep = sys.factor === 60 ? 5 : sys.factor >= 100 ? sys.factor / 10 : 1;
  const step = roundSmall ? roundStep : 1;
  const small = step * rng.int(1, sys.factor / step - 1);
  return { big, small, total: big * sys.factor + small };
}

/** „2 m 40 cm = ? cm“ */
export function mixedToSmall(sys: UnitSystem, rng: Rng, maxBig: number, roundSmall = true): GeneratedTask {
  const { big, small, total } = randomMixed(sys, rng, maxBig, roundSmall);
  return unitTask({
    prompt: `${formatMixed(total, sys)} = ? ${sys.small}`,
    sys,
    answer: total,
    distractors: [
      Number(`${big}${small}`), // Zahlen einfach hintereinander geschrieben: 2 kg 30 g → 230 g
      big + small, // nicht umgerechnet
      sys.factor === 60 ? big * 100 + small : big * sys.factor * 10 + small, // falscher Faktor bzw. 1 h = 100 min
      big * (sys.factor === 60 ? 10 : sys.factor / 10) + small, // falscher Faktor (zu klein)
    ],
    display: (t) => formatSmall(t.num / t.den, sys),
    explanation: [
      `${formatInteger(big)} ${sys.big} = ${formatSmall(big * sys.factor, sys)}`,
      `${formatSmall(big * sys.factor, sys)} + ${formatSmall(small, sys)} = ${formatSmall(total, sys)}`,
    ],
  });
}

/** „350 cm = ? m ? cm“ */
export function smallToMixed(sys: UnitSystem, rng: Rng, maxBig: number, roundSmall = true): GeneratedTask {
  const { big, small, total } = randomMixed(sys, rng, maxBig, roundSmall);
  // an der falschen Stelle getrennt (z. B. 135 min → 1 h 35 min oder 2 450 g → 24 kg 50 g)
  const splitAt = sys.factor === 60 ? 100 : 10 ** (commaPlaces(sys) - 1);
  const wrongSplit = Math.floor(total / splitAt) * sys.factor + (total % splitAt);
  return unitTask({
    prompt: `${formatSmall(total, sys)} = ? ${sys.big} ? ${sys.small}`,
    sys,
    answer: total,
    distractors: [wrongSplit, (big + 1) * sys.factor + small, (big - 1) * sys.factor + small, big * sys.factor + small / 10],
    display: (t) => formatMixed(t.num / t.den, sys),
    explanation: [
      `${formatSmall(total, sys)} = ${formatSmall(big * sys.factor, sys)} + ${formatSmall(small, sys)}`,
      `${formatSmall(big * sys.factor, sys)} = ${formatInteger(big)} ${sys.big}`,
      `${formatSmall(total, sys)} = ${formatMixed(total, sys)}`,
    ],
  });
}

/** Ganzzahliger Wert, aber nicht glatt durch den Faktor teilbar (sonst gäbe es kein Komma). */
function randomCommaTotal(sys: UnitSystem, rng: Rng, maxBig: number): number {
  return rng.int(1, maxBig) * sys.factor + rng.int(1, sys.factor - 1);
}

/** „3,45 m = ? cm“ */
export function commaToSmall(sys: UnitSystem, rng: Rng, maxBig: number): GeneratedTask {
  const total = randomCommaTotal(sys, rng, maxBig);
  const value = Rational.of(total);
  const comma = formatComma(value, sys);
  const [intText, fracText] = comma.split(' ')[0].split(',');
  const big = Number(intText.replace(/\D/g, ''));
  const places = commaPlaces(sys);
  const misread: number[] = [];
  if (fracText.length < places) {
    // „3,5 m“ als 3 m 5 cm gelesen → 305 cm
    misread.push(big * sys.factor + Number(fracText));
  }
  if (fracText.startsWith('0')) {
    // Null nach dem Komma übersehen: „3,05 €“ als 3,5 € → 350 ct
    const stripped = fracText.replace(/^0+/, '');
    misread.push(big * sys.factor + Number(stripped) * 10 ** (places - stripped.length));
  }
  return unitTask({
    prompt: `${comma} = ? ${sys.small}`,
    sys,
    answer: total,
    // Faktor 10 daneben (bei Geld nur nach oben – Bruchteile von Cent gibt es nicht), Kommastellen ignoriert
    distractors: [...misread, total * 10, ...(sys === UNITS.euroCt ? [] : [value.div(10)]), big * sys.factor],
    display: (t) => `${formatDecimal(t)} ${sys.small}`,
    explanation: [
      `1 ${sys.big} = ${formatSmall(sys.factor, sys)}`,
      `${comma} = ${comma.split(' ')[0]} ${TIMES} ${formatSmall(sys.factor, sys)} = ${formatSmall(total, sys)}`,
      `Das Komma rückt ${places} Stelle${places > 1 ? 'n' : ''} nach rechts.`,
    ],
  });
}

/** „345 cm = ? m“ (Antwort mit Komma) */
export function smallToComma(sys: UnitSystem, rng: Rng, maxBig: number): GeneratedTask {
  const total = randomCommaTotal(sys, rng, maxBig);
  const value = Rational.of(total);
  const places = commaPlaces(sys);
  return unitTask({
    prompt: `${formatSmall(total, sys)} = ? ${sys.big}`,
    sys,
    answer: total,
    // Komma um eine Stelle verrutscht (34,5 m / 0,345 m)
    distractors: [value.mul(10), value.div(10), value.mul(100), value.div(100)],
    display: (t) => formatComma(t, sys),
    explanation: [
      `${formatSmall(sys.factor, sys)} = 1 ${sys.big}`,
      `${formatSmall(total, sys)} = ${formatComma(value, sys)}`,
      `Das Komma rückt ${places} Stelle${places > 1 ? 'n' : ''} nach links.`,
    ],
  });
}
