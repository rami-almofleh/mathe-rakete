import { formatNumber, NumberStyle, Target } from './format';
import { Rational } from './rational';

/**
 * Linearer Term wie 3x − 2y + 7 (Koeffizient je Variable + Konstante).
 * Normalform: Variablen alphabetisch, Konstante am Ende, Nullglieder weg.
 */
export class LinearTerm {
  private constructor(
    readonly coefficients: ReadonlyMap<string, Rational>,
    readonly constant: Rational,
  ) {}

  static of(coefficients: Record<string, number | Rational>, constant: number | Rational = 0): LinearTerm {
    const map = new Map<string, Rational>();
    for (const [variable, c] of Object.entries(coefficients)) {
      const r = Rational.from(c);
      if (r.sign !== 0) map.set(variable, r);
    }
    return new LinearTerm(map, Rational.from(constant));
  }

  static constant(value: number | Rational): LinearTerm {
    return LinearTerm.of({}, value);
  }

  coefficient(variable: string): Rational {
    return this.coefficients.get(variable) ?? Rational.ZERO;
  }

  get variables(): string[] {
    return [...this.coefficients.keys()].sort();
  }

  add(other: LinearTerm): LinearTerm {
    const result: Record<string, Rational> = {};
    for (const v of new Set([...this.variables, ...other.variables])) {
      result[v] = this.coefficient(v).add(other.coefficient(v));
    }
    return LinearTerm.of(result, this.constant.add(other.constant));
  }

  scale(factor: number | Rational): LinearTerm {
    const f = Rational.from(factor);
    const result: Record<string, Rational> = {};
    for (const v of this.variables) result[v] = this.coefficient(v).mul(f);
    return LinearTerm.of(result, this.constant.mul(f));
  }

  sub(other: LinearTerm): LinearTerm {
    return this.add(other.scale(-1));
  }

  /** Wert für eine Belegung, z. B. { x: 2 }. */
  evaluate(values: Record<string, number | Rational>): Rational {
    return this.variables.reduce(
      (sum, v) => sum.add(this.coefficient(v).mul(Rational.from(values[v] ?? 0))),
      this.constant,
    );
  }

  equals(other: LinearTerm): boolean {
    return this.key() === other.key();
  }

  /** Normalisierter Vergleichsschlüssel, z. B. `x:2/1|c:7/1`. */
  key(): string {
    return [...this.variables.map((v) => `${v}:${this.coefficient(v).key()}`), `c:${this.constant.key()}`].join('|');
  }

  /** „2x + 7“, „−x + 3“, „x“, „0“ */
  format(target: Target = 'plain', style: NumberStyle = 'fraction'): string {
    const minus = target === 'tex' ? '-' : '−';
    const parts: { sign: 1 | -1; text: string }[] = [];
    for (const v of this.variables) {
      const c = this.coefficient(v);
      const abs = c.abs();
      const factor = abs.equals(1) ? '' : formatNumber(abs, style, target);
      parts.push({ sign: c.sign < 0 ? -1 : 1, text: `${factor}${v}` });
    }
    if (this.constant.sign !== 0 || parts.length === 0) {
      parts.push({ sign: this.constant.sign < 0 ? -1 : 1, text: formatNumber(this.constant.abs(), style, target) });
    }
    return parts
      .map((p, i) => (i === 0 ? (p.sign < 0 ? minus : '') + p.text : `${p.sign < 0 ? ` ${minus} ` : ' + '}${p.text}`))
      .join('');
  }
}
