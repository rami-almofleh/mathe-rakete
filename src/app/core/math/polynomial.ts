import { formatNumber, NumberStyle, Target } from './format';
import { Rational } from './rational';

type R = Rational | number;

/**
 * Polynom in einer Variablen mit exakten Koeffizienten, z. B. 3x² − 2x + 7.
 * `coefficients[k]` gehört zu xᵏ. Wird für binomische Formeln, quadratische Gleichungen
 * und (ab Kl. 11) Ableitungen/Stammfunktionen benutzt.
 */
export class Polynomial {
  readonly coefficients: readonly Rational[];

  private constructor(coefficients: Rational[]) {
    const trimmed = [...coefficients];
    while (trimmed.length > 1 && trimmed.at(-1)!.sign === 0) trimmed.pop();
    this.coefficients = trimmed.length ? trimmed : [Rational.ZERO];
  }

  /** Koeffizienten ab x⁰: `Polynomial.of(7, -2, 3)` = 3x² − 2x + 7. */
  static of(...coefficients: R[]): Polynomial {
    return new Polynomial(coefficients.map((c) => Rational.from(c)));
  }

  /** Von der höchsten Potenz abwärts: `fromHighest(3, -2, 7)` = 3x² − 2x + 7. */
  static fromHighest(...coefficients: R[]): Polynomial {
    return Polynomial.of(...[...coefficients].reverse());
  }

  /** c · xⁿ */
  static monomial(coefficient: R, degree: number): Polynomial {
    return Polynomial.of(...Array.from({ length: degree + 1 }, (_, i) => (i === degree ? coefficient : 0)));
  }

  /** (x − r₁)(x − r₂)… */
  static fromRoots(...roots: R[]): Polynomial {
    return roots.reduce<Polynomial>((p, r) => p.mul(Polynomial.of(Rational.from(r).neg(), 1)), Polynomial.of(1));
  }

  get degree(): number {
    return this.coefficients.length === 1 && this.coefficients[0].sign === 0 ? -Infinity : this.coefficients.length - 1;
  }

  coefficient(k: number): Rational {
    return this.coefficients[k] ?? Rational.ZERO;
  }

  add(other: Polynomial): Polynomial {
    const n = Math.max(this.coefficients.length, other.coefficients.length);
    return new Polynomial(Array.from({ length: n }, (_, k) => this.coefficient(k).add(other.coefficient(k))));
  }

  sub(other: Polynomial): Polynomial {
    return this.add(other.scale(-1));
  }

  scale(factor: R): Polynomial {
    return new Polynomial(this.coefficients.map((c) => c.mul(factor)));
  }

  mul(other: Polynomial): Polynomial {
    const result = Array.from({ length: this.coefficients.length + other.coefficients.length - 1 }, () => Rational.ZERO);
    this.coefficients.forEach((a, i) => other.coefficients.forEach((b, j) => (result[i + j] = result[i + j].add(a.mul(b)))));
    return new Polynomial(result);
  }

  pow(n: number): Polynomial {
    let result = Polynomial.of(1);
    for (let i = 0; i < n; i++) result = result.mul(this);
    return result;
  }

  evaluate(x: R): Rational {
    const v = Rational.from(x);
    return this.coefficients.reduceRight((acc, c) => acc.mul(v).add(c), Rational.ZERO);
  }

  derivative(): Polynomial {
    return new Polynomial(this.coefficients.slice(1).map((c, i) => c.mul(i + 1)));
  }

  /** Stammfunktion mit Konstante 0. */
  antiderivative(): Polynomial {
    return new Polynomial([Rational.ZERO, ...this.coefficients.map((c, i) => c.div(i + 1))]);
  }

  equals(other: Polynomial): boolean {
    return this.key() === other.key();
  }

  key(): string {
    return this.coefficients.map((c) => c.key()).join(',');
  }

  /** „3x² − 2x + 7“ bzw. `3x^{2} - 2x + 7` */
  format(target: Target = 'tex', variable = 'x', style: NumberStyle = 'fraction'): string {
    const minus = target === 'tex' ? '-' : '−';
    const sup = (k: number) => (target === 'tex' ? `^{${k}}` : superscriptDigits(k));
    const parts: string[] = [];
    for (let k = this.coefficients.length - 1; k >= 0; k--) {
      const c = this.coefficients[k];
      if (c.sign === 0 && !(k === 0 && parts.length === 0)) continue;
      const abs = c.abs();
      const power = k === 0 ? '' : k === 1 ? variable : `${variable}${sup(k)}`;
      const factor = k > 0 && abs.equals(1) ? '' : formatNumber(abs, style, target);
      const body = `${factor}${power}`;
      if (parts.length === 0) parts.push(c.sign < 0 ? `${minus}${body}` : body);
      else parts.push(c.sign < 0 ? ` ${minus} ${body}` : ` + ${body}`);
    }
    return parts.join('');
  }
}

const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

function superscriptDigits(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUPERSCRIPTS[Number(d)])
    .join('');
}
