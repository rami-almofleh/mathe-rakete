import { plain, tex } from '../../models';
import { formatDecimal, formatFraction, formatInteger, formatRounded } from '../../math/format';
import { Polynomial } from '../../math/polynomial';
import { Rational } from '../../math/rational';
import { Rng } from '../../math/rng';
import { AnswerFormat, textAnswer } from '../answers';
import { Answer } from '../generator';

export const signed = (rng: Rng, min: number, max: number) => rng.int(min, max) * rng.sign();

/** Polynom als Antwort; gleiche Polynome (auch anders geschrieben) gelten als gleich. */
export function polyAnswer(p: Polynomial, variable = 'x'): Answer {
  return textAnswer(tex(p.format('tex', variable)), `p:${variable}:${p.key()}`);
}

/** Antwort, bei der die Schreibweise zählt (z. B. „vollständig ausgeklammert“). */
export function formAnswer(texText: string): Answer {
  return textAnswer(tex(texText), `f:${texText}`);
}

/** „x = 5“ bzw. „x = −2,5“ */
export function solutionFormat(variable = 'x'): AnswerFormat {
  return (v) => ({ display: plain(`${variable} = ${formatDecimal(v)}`), key: `n:${v.key()}`, value: v });
}

/** Gerundete Größe: „≈ 78,54 cm²“. Der Schlüssel ist der gerundete Wert – so gibt es keine zwei gleich aussehenden Antworten. */
export function roundedFormat(unit: string, places: number): (value: number) => Answer {
  return (value) => {
    const text = formatRounded(value, places);
    const suffix = !unit ? '' : unit === '°' ? '°' : ` ${unit}`;
    return textAnswer(plain(`≈ ${text}${suffix}`), `r:${unit}:${text}`);
  };
}

/** Wert als gekürzter Bruch in LaTeX (ganze Zahlen ohne Nenner). */
export function texValue(v: Rational): string {
  return formatFraction(v, 'tex');
}

/** Punkt P(x | y) */
export function point(x: number | Rational, y: number | Rational, name = 'P'): string {
  const f = (v: number | Rational) => formatDecimal(Rational.from(v));
  return `${name}(${f(x)} | ${f(y)})`;
}

/** Punkt in LaTeX: P(1 \mid -2) */
export function texPoint(x: number | Rational, y: number | Rational, name = 'P'): string {
  return `${name}(${texValue(Rational.from(x))} \\mid ${texValue(Rational.from(y))})`;
}

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';

/** „x₁ = −7, x₂ = 4“, „x = 9“ oder „keine Lösung“ (`null`). Reihenfolge egal, doppelte zählen einfach. */
export function rootsAnswer(roots: readonly number[] | null): Answer {
  if (!roots || roots.length === 0) return textAnswer(plain('keine Lösung'), 'roots:none');
  const sorted = [...new Set(roots)].sort((a, b) => a - b);
  const text = sorted.length === 1 ? `x = ${formatInteger(sorted[0])}` : sorted.map((x, i) => `x${SUBSCRIPTS[i + 1]} = ${formatInteger(x)}`).join(', ');
  return textAnswer(plain(text), `roots:${sorted.join(',')}`);
}

/** Spaltenvektor in LaTeX */
export function texVector(components: readonly (number | Rational)[]): string {
  return `\\begin{pmatrix} ${components.map((c) => texValue(Rational.from(c))).join(' \\\\ ')} \\end{pmatrix}`;
}

/** Vektor als Antwort; gleiche Komponenten = gleiche Antwort. */
export function vectorAnswer(components: readonly number[]): Answer {
  return textAnswer(tex(texVector(components)), `vec:${components.join(',')}`);
}
