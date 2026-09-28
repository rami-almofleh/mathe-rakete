import { Grade } from '../models';
import { Rational } from '../math/rational';

/** Welche Zahlen in einer Klasse als Antwort vorkommen dürfen. */
export interface NumberDomain {
  readonly allowNegative: boolean;
  readonly allowNonInteger: boolean;
}

/** Negative Zahlen ab Kl. 7, Brüche/Dezimalzahlen ab Kl. 6 (siehe docs/RECHERCHE.md). */
export function defaultDomain(grade: Grade): NumberDomain {
  return {
    allowNegative: grade >= 7,
    allowNonInteger: grade >= 6,
  };
}

export function inDomain(value: Rational, domain: NumberDomain): boolean {
  return (domain.allowNegative || value.sign >= 0) && (domain.allowNonInteger || value.isInteger());
}
