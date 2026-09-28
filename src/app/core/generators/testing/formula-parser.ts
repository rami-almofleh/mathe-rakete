import { Rational } from '../../math/rational';

/**
 * Unabhängiger Parser für Tests: liest angezeigte Aufgaben/Antworten (Klartext oder LaTeX)
 * und rechnet sie exakt aus. Absichtlich getrennt von den Generatoren – so fällt auf, wenn
 * ein Generator etwas anderes anzeigt, als er für richtig hält.
 *
 * Unterstützt: Zahlen mit Dezimalkomma, − / -, + · : \cdot, Klammern, \frac{a}{b},
 * Hochzahlen (⁰–⁹), Variablen (x, a, b) mit impliziter Multiplikation (3x, 2(x − 1)).
 */

type Token =
  | { type: 'num'; value: Rational }
  | { type: 'var'; name: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'pow'; value: number }
  | { type: 'frac' }
  | { type: '(' | ')' | '{' | '}' };

const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

export function normalizeFormula(text: string): string {
  return text
    .replace(/(\d)\\,(?=\d)/g, '$1') // Tausendertrennung 1\,000
    .replace(/\\left|\\right|\\;|\\,|\\quad|\\!/g, ' ')
    .replace(/\\[td]frac/g, '\\frac')
    .replace(/\\cdot/g, '·')
    .replace(/\{,\}/g, ',')
    .replace(/−/g, '-')
    .replace(/ /g, '')
    .trim();
}

function tokenize(input: string): Token[] {
  const text = normalizeFormula(input);
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === ' ') {
      i++;
    } else if (/\d/.test(c)) {
      const m = /^\d+(,\d+)?/.exec(text.slice(i))!;
      const [int, frac = ''] = m[0].split(',');
      tokens.push({ type: 'num', value: Rational.decimal(Number(int + frac), frac.length) });
      i += m[0].length;
    } else if (SUPERSCRIPTS.includes(c)) {
      let digits = '';
      while (i < text.length && SUPERSCRIPTS.includes(text[i])) digits += SUPERSCRIPTS.indexOf(text[i++]);
      tokens.push({ type: 'pow', value: Number(digits) });
    } else if (text.startsWith('\\frac', i)) {
      tokens.push({ type: 'frac' });
      i += 5;
    } else if ('+-'.includes(c)) {
      tokens.push({ type: 'op', value: c as '+' | '-' });
      i++;
    } else if (c === '·') {
      tokens.push({ type: 'op', value: '*' });
      i++;
    } else if (c === ':') {
      tokens.push({ type: 'op', value: '/' });
      i++;
    } else if ('(){}'.includes(c)) {
      tokens.push({ type: c as '(' });
      i++;
    } else if (/[a-z]/.test(c)) {
      tokens.push({ type: 'var', name: c });
      i++;
    } else {
      throw new Error(`Unbekanntes Zeichen „${c}“ in „${input}“`);
    }
  }
  return tokens;
}

export function evaluateFormula(input: string, variables: Record<string, number> = {}): Rational {
  const tokens = tokenize(input);
  let pos = 0;
  const peek = () => tokens[pos];
  const expect = (type: Token['type']) => {
    const t = tokens[pos++];
    if (!t || t.type !== type) throw new Error(`„${type}“ erwartet in „${input}“`);
  };

  const expression = (): Rational => {
    let value = term();
    while (peek()?.type === 'op' && ['+', '-'].includes((peek() as { value: string }).value)) {
      const op = (tokens[pos++] as { value: string }).value;
      value = op === '+' ? value.add(term()) : value.sub(term());
    }
    return value;
  };

  const startsFactor = (t: Token | undefined) => !!t && ['num', 'var', '(', 'frac'].includes(t.type);

  const term = (): Rational => {
    let value = unary();
    for (;;) {
      const t = peek();
      if (t?.type === 'op' && (t.value === '*' || t.value === '/')) {
        pos++;
        value = t.value === '*' ? value.mul(unary()) : value.div(unary());
      } else if (startsFactor(t)) {
        value = value.mul(power()); // 3x, 2(x − 1)
      } else {
        return value;
      }
    }
  };

  const unary = (): Rational => {
    const t = peek();
    if (t?.type === 'op' && t.value === '-') {
      pos++;
      return unary().neg();
    }
    return power();
  };

  const power = (): Rational => {
    const base = atom();
    const t = peek();
    if (t?.type === 'pow') {
      pos++;
      return base.pow(t.value);
    }
    return base;
  };

  const atom = (): Rational => {
    const t = tokens[pos++];
    if (!t) throw new Error(`Unerwartetes Ende in „${input}“`);
    switch (t.type) {
      case 'num':
        return t.value;
      case 'var':
        if (!(t.name in variables)) throw new Error(`Variable ${t.name} ohne Wert`);
        return Rational.of(variables[t.name]);
      case '(': {
        const v = expression();
        expect(')');
        return v;
      }
      case 'frac': {
        expect('{');
        const num = expression();
        expect('}');
        expect('{');
        const den = expression();
        expect('}');
        return num.div(den);
      }
      default:
        throw new Error(`Unerwartetes „${t.type}“ in „${input}“`);
    }
  };

  const value = expression();
  if (pos !== tokens.length) throw new Error(`Rest nicht verstanden in „${input}“`);
  return value;
}

/**
 * Gleitkomma-Auswertung für Formeln mit Wurzeln, π und beliebigen Exponenten
 * (\sqrt{…}, \sqrt[n]{…}, x^{…}, \pi). Für Werte wie 6√2 oder 8^(2/3).
 */
export function evaluateNumeric(input: string, variables: Record<string, number> = {}): number {
  const text = normalizeFormula(input).replace(/\\pi/g, 'π').replace(/\^\{\\circ\}/g, '');
  let pos = 0;
  const skip = () => {
    while (text[pos] === ' ') pos++;
  };
  const peek = () => {
    skip();
    return text[pos];
  };
  const eat = (s: string) => {
    skip();
    if (!text.startsWith(s, pos)) throw new Error(`„${s}“ erwartet in „${input}“ bei ${pos}`);
    pos += s.length;
  };

  const expression = (): number => {
    let v = term();
    for (let c = peek(); c === '+' || c === '-'; c = peek()) {
      pos++;
      v = c === '+' ? v + term() : v - term();
    }
    return v;
  };
  const startsFactor = (c: string | undefined) =>
    !!c && (/[\d(a-zπ{]/.test(c) || text.startsWith('\\frac', pos) || text.startsWith('\\sqrt', pos) || text.startsWith('\\ln', pos));
  const term = (): number => {
    let v = unary();
    for (;;) {
      const c = peek();
      if (c === '·' || c === ':') {
        pos++;
        v = c === '·' ? v * unary() : v / unary();
      } else if (startsFactor(c)) {
        v *= power();
      } else {
        return v;
      }
    }
  };
  const unary = (): number => {
    if (peek() === '-') {
      pos++;
      return -unary();
    }
    return power();
  };
  const power = (): number => {
    const base = atom();
    const c = peek();
    if (c === '^') {
      pos++;
      if (peek() === '{') {
        eat('{');
        const e = expression();
        eat('}');
        return base ** e;
      }
      skip();
      return base ** Number(text[pos++]);
    }
    if (c && SUPERSCRIPTS.includes(c)) {
      let digits = '';
      while (pos < text.length && SUPERSCRIPTS.includes(text[pos])) digits += SUPERSCRIPTS.indexOf(text[pos++]);
      return base ** Number(digits);
    }
    return base;
  };
  const group = (): number => {
    eat('{');
    const v = expression();
    eat('}');
    return v;
  };
  const atom = (): number => {
    const c = peek();
    if (text.startsWith('\\frac', pos)) {
      pos += 5;
      const n = group();
      return n / group();
    }
    if (text.startsWith('\\ln', pos)) {
      pos += 3;
      return Math.log(atom());
    }
    if (text.startsWith('\\sqrt', pos)) {
      pos += 5;
      let degree = 2;
      if (peek() === '[') {
        pos++;
        const end = text.indexOf(']', pos);
        degree = Number(text.slice(pos, end));
        pos = end + 1;
      }
      return group() ** (1 / degree);
    }
    if (c === '(') {
      pos++;
      const v = expression();
      eat(')');
      return v;
    }
    if (c === '{') return group();
    if (c === 'π') {
      pos++;
      return Math.PI;
    }
    if (c && /\d/.test(c)) {
      const m = /^\d+(,\d+)?/.exec(text.slice(pos))!;
      pos += m[0].length;
      return Number(m[0].replace(',', '.'));
    }
    if (c && /[a-z]/.test(c)) {
      pos++;
      if (!(c in variables)) throw new Error(`Variable ${c} ohne Wert`);
      return variables[c];
    }
    throw new Error(`Unerwartet „${c}“ in „${input}“`);
  };
  const value = expression();
  skip();
  if (pos !== text.length) throw new Error(`Rest nicht verstanden in „${input}“: „${text.slice(pos)}“`);
  return value;
}

/** Linke Seite einer Aufgabe „… = ?“ bzw. „… = \;?“ */
export function leftOfQuestion(prompt: string): string {
  return prompt.replace(/=\s*(\\;)?\s*\?\s*$/, '').trim();
}

/** Zahl mit optionaler Einheit: „28 cm²“ → { value: 28, unit: 'cm²' }, „75 %“, „60°“. */
export function parseQuantity(text: string): { value: Rational; unit: string } {
  const normalized = normalizeFormula(text);
  const m = /^(-?[\d,]+|\\frac\{\d+\}\{\d+\}|-\\frac\{\d+\}\{\d+\})\s*(.*)$/.exec(normalized);
  if (!m) throw new Error(`Keine Zahl in „${text}“`);
  return { value: evaluateFormula(m[1]), unit: m[2].trim() };
}
