import { primeFactors } from '../../math/number-theory';

export { digitsOf } from '../primary/helpers';

const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** 25 → „²⁵“ (für Potenzen im Klartext, z. B. 2⁵). */
export function superscript(n: number): string {
  const digits = String(Math.abs(n))
    .split('')
    .map((d) => SUPERSCRIPT_DIGITS[Number(d)])
    .join('');
  return n < 0 ? `⁻${digits}` : digits;
}

/** Sieht auf den ersten Blick wie eine Primzahl aus: ungerade und endet nicht auf 5 (z. B. 51, 91). */
export function isPrimeLike(n: number): boolean {
  return n % 2 === 1 && n % 5 !== 0;
}

/** 91 → „7 · 13“ */
export function primeFactorText(n: number): string {
  return primeFactors(n).join(' · ');
}
