import { gcd } from './number-theory';

type RationalLike = Rational | number;

/**
 * Exakte rationale Zahl (immer gekürzt, Nenner > 0). Damit vergleichen wir Antworten
 * ohne Gleitkomma-Fehler: 0,1 + 0,2 ist hier wirklich 0,3.
 */
export class Rational {
  static readonly ZERO = new Rational(0, 1);
  static readonly ONE = new Rational(1, 1);

  private constructor(
    readonly num: number,
    readonly den: number,
  ) {}

  static of(num: number, den = 1): Rational {
    if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den)) {
      throw new RangeError(`Zähler und Nenner müssen ganze Zahlen sein: ${num}/${den}`);
    }
    if (den === 0) {
      throw new RangeError('Der Nenner darf nicht 0 sein');
    }
    const sign = den < 0 ? -1 : 1;
    const g = gcd(num, den);
    // `|| 0` verhindert −0
    return new Rational((sign * num) / g || 0, Math.abs(den) / g);
  }

  /** Dezimalzahl aus skalierter ganzer Zahl: `decimal(345, 2)` = 3,45. */
  static decimal(scaled: number, places: number): Rational {
    return Rational.of(scaled, 10 ** places);
  }

  static from(value: RationalLike): Rational {
    return value instanceof Rational ? value : Rational.of(value);
  }

  add(other: RationalLike): Rational {
    const o = Rational.from(other);
    return Rational.of(this.num * o.den + o.num * this.den, this.den * o.den);
  }

  sub(other: RationalLike): Rational {
    return this.add(Rational.from(other).neg());
  }

  mul(other: RationalLike): Rational {
    const o = Rational.from(other);
    return Rational.of(this.num * o.num, this.den * o.den);
  }

  div(other: RationalLike): Rational {
    const o = Rational.from(other);
    if (o.num === 0) {
      throw new RangeError('Division durch 0');
    }
    return Rational.of(this.num * o.den, this.den * o.num);
  }

  neg(): Rational {
    return Rational.of(-this.num, this.den);
  }

  abs(): Rational {
    return this.num < 0 ? this.neg() : this;
  }

  /** Potenz mit ganzzahligem Exponenten. */
  pow(exponent: number): Rational {
    if (!Number.isInteger(exponent)) {
      throw new RangeError('Nur ganzzahlige Exponenten');
    }
    if (exponent < 0) {
      return Rational.ONE.div(this.pow(-exponent));
    }
    return Rational.of(this.num ** exponent, this.den ** exponent);
  }

  get sign(): -1 | 0 | 1 {
    return this.num === 0 ? 0 : this.num < 0 ? -1 : 1;
  }

  isInteger(): boolean {
    return this.den === 1;
  }

  equals(other: RationalLike): boolean {
    const o = Rational.from(other);
    return this.num === o.num && this.den === o.den;
  }

  compare(other: RationalLike): number {
    const o = Rational.from(other);
    return Math.sign(this.num * o.den - o.num * this.den);
  }

  /** Ganzzahliger Anteil (Richtung 0), z. B. 7/2 → 3, −7/2 → −3. */
  trunc(): number {
    return Math.trunc(this.num / this.den);
  }

  /**
   * Anzahl Nachkommastellen, wenn die Zahl ein abbrechender Dezimalbruch ist
   * (Nenner hat nur die Primfaktoren 2 und 5), sonst `null` (z. B. 1/3).
   */
  decimalPlaces(): number | null {
    let d = this.den;
    let twos = 0;
    let fives = 0;
    while (d % 2 === 0) {
      d /= 2;
      twos++;
    }
    while (d % 5 === 0) {
      d /= 5;
      fives++;
    }
    return d === 1 ? Math.max(twos, fives) : null;
  }

  toNumber(): number {
    return this.num / this.den;
  }

  /** Eindeutiger Schlüssel für Vergleiche, z. B. `3/4`. */
  key(): string {
    return `${this.num}/${this.den}`;
  }

  toString(): string {
    return this.den === 1 ? `${this.num}` : this.key();
  }
}
