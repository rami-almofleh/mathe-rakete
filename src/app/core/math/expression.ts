import { Operation } from '../models';
import { formatOperand, NumberStyle, OPERATION_SYMBOL, Target } from './format';
import { Rational } from './rational';

/**
 * Rechenausdruck als Baum, z. B. 3 + 4 · (8 − 5). Damit lassen sich Aufgaben mit
 * Punkt-vor-Strich und Klammern bauen, exakt auswerten – und typische Fehler
 * („von links nach rechts gerechnet“, „Klammern ignoriert“) nachrechnen.
 */
export type Expr =
  | { readonly kind: 'num'; readonly value: Rational }
  | { readonly kind: 'bin'; readonly op: Operation; readonly left: Expr; readonly right: Expr; readonly forceParens?: boolean };

export function num(value: number | Rational): Expr {
  return { kind: 'num', value: Rational.from(value) };
}

export function bin(op: Operation, left: Expr | number, right: Expr | number): Expr {
  const wrap = (e: Expr | number) => (typeof e === 'number' ? num(e) : e);
  return { kind: 'bin', op, left: wrap(left), right: wrap(right) };
}

/** Klammer, die mathematisch nicht nötig wäre (z. B. für Rechengesetze: a + (b + c)). */
export function paren(e: Expr): Expr {
  return e.kind === 'bin' ? { ...e, forceParens: true } : e;
}

const PRECEDENCE: Record<Operation, number> = { add: 1, sub: 1, mul: 2, div: 2 };

function apply(op: Operation, a: Rational, b: Rational): Rational {
  switch (op) {
    case 'add':
      return a.add(b);
    case 'sub':
      return a.sub(b);
    case 'mul':
      return a.mul(b);
    case 'div':
      return a.div(b);
  }
}

export function evaluate(e: Expr): Rational {
  return e.kind === 'num' ? e.value : apply(e.op, evaluate(e.left), evaluate(e.right));
}

/** Alle Zwischenergebnisse (für Prüfungen wie „nie negativ“, „immer ganzzahlig“). */
export function intermediates(e: Expr): Rational[] {
  if (e.kind === 'num') return [];
  return [...intermediates(e.left), ...intermediates(e.right), evaluate(e)];
}

export function operationsIn(e: Expr): Set<Operation> {
  if (e.kind === 'num') return new Set();
  return new Set([e.op, ...operationsIn(e.left), ...operationsIn(e.right)]);
}

function needsParens(child: Expr, parentOp: Operation, isRight: boolean): boolean {
  if (child.kind === 'num') return false;
  if (child.forceParens) return true;
  const pc = PRECEDENCE[child.op];
  const pp = PRECEDENCE[parentOp];
  return pc < pp || (isRight && pc === pp && (parentOp === 'sub' || parentOp === 'div'));
}

export function formatExpr(e: Expr, target: Target = 'plain', style: NumberStyle = 'decimal'): string {
  if (e.kind === 'num') {
    return formatOperand(e.value, style, target);
  }
  const side = (child: Expr, isRight: boolean) => {
    const text = formatExpr(child, target, style);
    if (!needsParens(child, e.op, isRight)) return text;
    return target === 'tex' ? `\\left(${text}\\right)` : `(${text})`;
  };
  return `${side(e.left, false)} ${OPERATION_SYMBOL[e.op][target]} ${side(e.right, true)}`;
}

type Token = Rational | Operation;

/** Zerlegt in Zahlen und Zeichen; Teilausdrücke in (nötigen) Klammern bleiben ganz, außer `flattenParens`. */
function tokens(e: Expr, flattenParens: boolean): Token[] {
  if (e.kind === 'num') return [e.value];
  const side = (child: Expr, isRight: boolean): Token[] =>
    !flattenParens && needsParens(child, e.op, isRight) ? [evaluate(child)] : tokens(child, flattenParens);
  return [...side(e.left, false), e.op, ...side(e.right, true)];
}

function evaluateTokens(list: Token[], pointBeforeDash: boolean): Rational {
  const values: Rational[] = [list[0] as Rational];
  const ops: Operation[] = [];
  for (let i = 1; i < list.length; i += 2) {
    const op = list[i] as Operation;
    const value = list[i + 1] as Rational;
    if (pointBeforeDash && (op === 'mul' || op === 'div')) {
      values.push(apply(op, values.pop()!, value));
    } else {
      ops.push(op);
      values.push(value);
    }
  }
  return ops.reduce((acc, op, i) => apply(op, acc, values[i + 1]), values[0]);
}

/** Fehler: stur von links nach rechts gerechnet (3 + 4 · 5 → 35). Klammern werden beachtet. */
export function evaluateLeftToRight(e: Expr): Rational {
  return evaluateTokens(tokens(e, false), false);
}

/** Fehler: Klammern übersehen (4 · (8 − 5) → 4 · 8 − 5). Punkt vor Strich wird beachtet. */
export function evaluateIgnoringParens(e: Expr): Rational {
  return evaluateTokens(tokens(e, true), true);
}

/**
 * Rechenweg Schritt für Schritt: „3 + 4 · 5“, „= 3 + 20“, „= 23“.
 * Es wird immer der linke Teilausdruck zuerst vereinfacht – die Baumstruktur sorgt für Punkt vor Strich.
 */
export function evaluationSteps(e: Expr, target: Target = 'plain', style: NumberStyle = 'decimal'): string[] {
  const reduce = (node: Expr): Expr => {
    if (node.kind === 'num') return node;
    if (node.left.kind === 'num' && node.right.kind === 'num') return num(evaluate(node));
    return node.left.kind === 'bin' ? { ...node, left: reduce(node.left) } : { ...node, right: reduce(node.right) };
  };
  const steps = [formatExpr(e, target, style)];
  let current = e;
  while (current.kind === 'bin') {
    current = reduce(current);
    steps.push(`= ${formatExpr(current, target, style)}`);
  }
  return steps;
}
