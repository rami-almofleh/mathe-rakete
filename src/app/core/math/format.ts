import { Operation } from '../models';
import { Rational } from './rational';

/**
 * Deutsche Schreibweise für Zahlen: Dezimalkomma, echtes Minuszeichen, `·` und `:`,
 * Tausendergruppen mit schmalem Leerzeichen (1 000). `plain` ist Text, `tex` ist KaTeX-Eingabe.
 */
export type Target = 'plain' | 'tex';

const MINUS: Record<Target, string> = { plain: '−', tex: '-' };
const GROUP_SEPARATOR: Record<Target, string> = { plain: ' ', tex: '\\,' };
const DECIMAL_COMMA: Record<Target, string> = { plain: ',', tex: '{,}' };

export const OPERATION_SYMBOL: Readonly<Record<Operation, Record<Target, string>>> = {
  add: { plain: '+', tex: '+' },
  sub: { plain: '−', tex: '-' },
  mul: { plain: '·', tex: '\\cdot' },
  div: { plain: ':', tex: ':' },
};

function groupDigits(digits: string, target: Target): string {
  if (digits.length <= 3) {
    return digits;
  }
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR[target]);
}

export function formatInteger(n: number, target: Target = 'plain'): string {
  if (!Number.isInteger(n)) {
    throw new RangeError(`Keine ganze Zahl: ${n}`);
  }
  const digits = groupDigits(String(Math.abs(n)), target);
  return n < 0 ? MINUS[target] + digits : digits;
}

/** Exakte Dezimalschreibweise, z. B. 3,45. Wirft, wenn die Zahl nicht abbricht (1/3). */
export function formatDecimal(value: Rational, target: Target = 'plain'): string {
  const places = value.decimalPlaces();
  if (places === null) {
    throw new RangeError(`${value.key()} ist kein abbrechender Dezimalbruch`);
  }
  return formatFixed(value, places, target);
}

/** Auf `places` Nachkommastellen gerundet (kaufmännisch), z. B. für Kreisflächen. */
export function formatRounded(value: Rational | number, places: number, target: Target = 'plain'): string {
  const scale = 10 ** places;
  const x = value instanceof Rational ? value.toNumber() : value;
  // toPrecision gleicht Darstellungsfehler aus (1,005 · 100 = 100,4999…) → sonst 1,00 statt 1,01
  const scaled = Math.sign(x) * Math.round(Number((Math.abs(x) * scale).toPrecision(12)));
  return formatFixed(Rational.of(scaled, scale), places, target);
}

function formatFixed(value: Rational, places: number, target: Target): string {
  const scaled = value.mul(10 ** places);
  if (!scaled.isInteger()) {
    throw new RangeError(`${value.key()} hat mehr als ${places} Nachkommastellen`);
  }
  const abs = Math.abs(scaled.num);
  const intPart = Math.floor(abs / 10 ** places);
  const fracPart = String(abs % 10 ** places).padStart(places, '0');
  const sign = scaled.num < 0 ? MINUS[target] : '';
  const int = groupDigits(String(intPart), target);
  return places === 0 ? sign + int : `${sign}${int}${DECIMAL_COMMA[target]}${fracPart}`;
}

/** Bruchschreibweise: `3/4` bzw. `\frac{3}{4}`. Ganze Zahlen ohne Nenner. */
export function formatFraction(value: Rational, target: Target = 'plain'): string {
  if (value.isInteger()) {
    return formatInteger(value.num, target);
  }
  const sign = value.sign < 0 ? MINUS[target] : '';
  const num = Math.abs(value.num);
  return target === 'tex' ? `${sign}\\frac{${num}}{${value.den}}` : `${sign}${num}/${value.den}`;
}

export type NumberStyle = 'fraction' | 'decimal';

export function formatNumber(value: Rational, style: NumberStyle = 'decimal', target: Target = 'plain'): string {
  return style === 'fraction' ? formatFraction(value, target) : formatDecimal(value, target);
}

/** Negative Zahlen als Rechenglied in Klammern: 5 − (−3). */
export function formatOperand(value: Rational, style: NumberStyle = 'decimal', target: Target = 'plain'): string {
  const text = formatNumber(value, style, target);
  if (value.sign >= 0) {
    return text;
  }
  return target === 'tex' ? `\\left(${text}\\right)` : `(${text})`;
}
