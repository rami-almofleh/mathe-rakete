import { Difficulty, MathContent, Operation, plain } from '../models';
import { formatDecimal, formatFraction, formatRounded, NumberStyle } from '../math/format';
import { Rational } from '../math/rational';
import { Rng } from '../math/rng';
import { AnswerFormat, answersFor, nearbyFallback, numberFormat } from './answers';
import { NumberDomain } from './domain';
import { GeneratedTask, GenerationContext, TaskGenerator } from './generator';

export function generator(topicId: string, generate: (context: GenerationContext) => GeneratedTask): TaskGenerator {
  return { topicId, generate };
}

export function byDifficulty<T>(difficulty: Difficulty, options: Record<Difficulty, () => T>): T {
  return options[difficulty]();
}

/** Wählt eine der Rechenarten des Themas, eingeschränkt auf die vom Kind gewählten. */
export function pickOperation<T extends Operation>(context: GenerationContext, available: readonly T[]): T {
  return context.rng.pick(allowedOperations(context, available));
}

export function allowedOperations<T extends Operation>(context: GenerationContext, available: readonly T[]): T[] {
  const allowed = available.filter((op) => !context.operations?.length || context.operations.includes(op));
  return allowed.length ? allowed : [...available];
}

/** Zieht so lange, bis die Bedingung erfüllt ist (Rejection Sampling). */
export function sample<T>(rng: Rng, draw: (rng: Rng) => T, accept: (value: T) => boolean, maxTries = 2000): T {
  for (let i = 0; i < maxTries; i++) {
    const value = draw(rng);
    if (accept(value)) {
      return value;
    }
  }
  throw new Error('Keine passende Zufallszahl gefunden');
}

export function lines(...texts: string[]): MathContent[] {
  return texts.map(plain);
}

/** Zahl mit Einheit, z. B. „28 cm²“; der Wert fließt in die Zahlenbereich-Prüfung ein. */
export function quantityFormat(unit: string, style: NumberStyle = 'decimal'): AnswerFormat {
  return (value) => {
    const text = style === 'fraction' ? formatFraction(value) : formatDecimal(value);
    return { display: plain(unit ? `${text} ${unit}` : text), key: `q:${unit}:${value.key()}`, value };
  };
}

/** Geldbetrag: „15 €“ oder „12,50 €“ – nie „12,5 €“, nie Bruchteile von Cent. */
export function moneyFormat(): AnswerFormat {
  return (value) => {
    const places = value.decimalPlaces();
    if (places === null || places > 2) {
      throw new RangeError('Kein gültiger Geldbetrag');
    }
    const text = value.isInteger() ? formatDecimal(value) : formatRounded(value, 2);
    return { display: plain(`${text} €`), key: `q:€:${value.key()}`, value };
  };
}

/** Winkel: „60°“ */
export function degreeFormat(): AnswerFormat {
  return (value) => ({ display: plain(`${formatDecimal(value)}°`), key: `q:°:${value.key()}`, value });
}

export interface ValueTaskOptions {
  readonly prompt: MathContent;
  readonly instruction?: string;
  readonly answer: Rational | number;
  /** Ergebnisse typischer Fehler; nicht darstellbare/doppelte/unpassende werden aussortiert. */
  readonly distractors: readonly (Rational | number)[];
  readonly format?: AnswerFormat;
  readonly explanation?: readonly MathContent[];
  readonly nearby?: (rng: Rng) => Rational;
  readonly domain?: Partial<NumberDomain>;
}

/** Aufgabe mit Zahl als Lösung (ganz, negativ, Bruch oder Dezimalzahl). */
export function valueTask(options: ValueTaskOptions): GeneratedTask {
  const format = options.format ?? numberFormat();
  const answer = Rational.from(options.answer);
  const nearby = options.nearby;
  return {
    prompt: { instruction: options.instruction, math: options.prompt },
    answer: format(answer),
    distractors: answersFor(options.distractors, format),
    fallback: nearby ? (rng) => format(nearby(rng)) : nearbyFallback(answer, format),
    explanation: options.explanation,
    domain: options.domain,
  };
}
