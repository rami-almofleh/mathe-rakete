import { MathContent, plain, tex } from '../models';
import { formatNumber, NumberStyle, Target } from '../math/format';
import { Rational } from '../math/rational';
import { Rng } from '../math/rng';
import { Answer } from './generator';

export type AnswerFormat = (value: Rational) => Answer;

export function numberAnswer(value: Rational | number, style: NumberStyle = 'decimal', target: Target = 'plain'): Answer {
  const v = Rational.from(value);
  const text = formatNumber(v, style, target);
  return {
    display: target === 'tex' ? tex(text) : plain(text),
    key: `n:${v.key()}`,
    value: v,
  };
}

/** Formatierer für Zahlenantworten im gleichen Stil, z. B. `numberFormat('fraction', 'tex')`. */
export function numberFormat(style: NumberStyle = 'decimal', target: Target = 'plain'): AnswerFormat {
  return (value) => numberAnswer(value, style, target);
}

/** Nicht-numerische Antwort (Term, Punkt, „7 Rest 1“ …); der Key muss normalisiert sein. */
export function textAnswer(display: MathContent, key: string): Answer {
  return { display, key: `t:${key}` };
}

/**
 * Formatiert mehrere Werte und überspringt solche, die sich nicht darstellen lassen
 * (z. B. 1/3 als Dezimalzahl). Praktisch für Fehlermuster-Listen.
 */
export function answersFor(values: readonly (Rational | number)[], format: AnswerFormat): Answer[] {
  const result: Answer[] = [];
  for (const value of values) {
    try {
      result.push(format(Rational.from(value)));
    } catch {
      // nicht darstellbar → kein sinnvoller Ablenker
    }
  }
  return result;
}

/** Ein Wert „in der Nähe“: typische Verzähl- und Stellenwertfehler. */
export function nearbyValue(value: Rational, rng: Rng): Rational {
  if (value.isInteger()) {
    const abs = Math.abs(value.num);
    const steps = [1, 2, 3];
    if (abs >= 20) steps.push(10);
    if (abs >= 200) steps.push(100);
    return value.add(rng.pick(steps) * rng.sign());
  }
  const places = value.decimalPlaces();
  if (places !== null) {
    const unit = Rational.decimal(1, places);
    return value.add(unit.mul(rng.pick([1, 2, 10]) * rng.sign()));
  }
  // echter Bruch: Zähler oder Nenner um 1 verändern
  if (rng.chance(0.5) || value.den <= 2) {
    return Rational.of(value.num + rng.sign(), value.den);
  }
  return Rational.of(value.num, value.den + rng.sign());
}

/** Standard-Auffüller für Zahlenaufgaben. */
export function nearbyFallback(value: Rational, format: AnswerFormat): (rng: Rng) => Answer {
  return (rng) => format(nearbyValue(value, rng));
}
