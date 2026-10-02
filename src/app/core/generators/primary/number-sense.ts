import { Difficulty, plain } from '../../models';
import { Rng } from '../../math/rng';
import { textAnswer } from '../answers';
import { GeneratedTask } from '../generator';
import { BOX, byDifficulty, digitsOf, expr, integerTask, MINUS, PLUS, sample, subtractSmallerDigit, subtractWithoutBorrow } from './helpers';

/**
 * Zahlvorstellung, in jeder Klasse im eigenen Zahlenraum: Stellentafel, Nachbarzahlen,
 * Vergleichen, Ergänzen. Kl. 2 rechnet bis 100, Kl. 3 bis 1 000, Kl. 4 bis 1 Million.
 */

// ---- Stellentafel ------------------------------------------------------------------------------

export const PLACE_VALUE = { HT: 100_000, ZT: 10_000, T: 1000, H: 100, Z: 10, E: 1 } as const;
export type Place = keyof typeof PLACE_VALUE;
type PlacePart = readonly [count: number, place: Place];

export interface PlaceValueConfig {
  /** Stellen von groß nach klein, z. B. `['H', 'Z', 'E']` */
  readonly places: readonly Place[];
  /** Nur so viele (nicht leere) Stellen zeigen – Kl. 4: „3 HT + 5 T + 2 Z“, die Nullen muss das Kind selbst denken. */
  readonly sparse?: number;
  readonly max: number;
}

const sumOf = (parts: readonly PlacePart[]) => parts.reduce((sum, [c, p]) => sum + c * PLACE_VALUE[p], 0);
const byValue = (a: PlacePart, b: PlacePart) => PLACE_VALUE[b[1]] - PLACE_VALUE[a[1]];

/**
 * „3 H + 4 Z + 7 E = ?“ – auch in anderer Reihenfolge und mit Bündeln (13 Z).
 * Typische Fehler: Ziffern in der gezeigten Reihenfolge abgeschrieben (Nullen vergessen),
 * Bündeln vergessen, die zwei kleinsten Stellen vertauscht.
 */
export function placeValueTask(parts: readonly PlacePart[], max: number): GeneratedTask {
  const total = sumOf(parts);
  const sorted = [...parts].sort(byValue);
  const [low, second] = [sorted.at(-1)!, sorted.at(-2)];
  const swapped = second ? total - low[0] * PLACE_VALUE[low[1]] - second[0] * PLACE_VALUE[second[1]] + low[0] * PLACE_VALUE[second[1]] + second[0] * PLACE_VALUE[low[1]] : total;
  const step = PLACE_VALUE[low[1]] * 10;
  return integerTask({
    prompt: `${parts.map(([c, p]) => `${c} ${p}`).join(' + ')} = ?`,
    answer: total,
    distractors: [
      Number(parts.map(([c]) => c).join('')),
      parts.reduce((sum, [c, p]) => sum + (c % 10) * PLACE_VALUE[p], 0),
      swapped,
      total + step,
      total - step,
      total + PLACE_VALUE[sorted[0][1]],
    ],
    explanation: [
      ...parts.map(([c, p]) => `${c} ${p} = ${expr(c * PLACE_VALUE[p])}`),
      expr(...parts.flatMap(([c, p], i) => (i ? [PLUS, c * PLACE_VALUE[p]] : [c * PLACE_VALUE[p]])), '=', total),
    ],
    max,
  });
}

/** Stellen mit Ziffern füllen: höchste Stelle 1–9, sonst 0–9 (bzw. bei `sparse` nur ausgewählte Stellen, je 1–9). */
function drawParts(rng: Rng, config: PlaceValueConfig, noZeros = false): PlacePart[] {
  if (config.sparse) {
    const chosen = rng.shuffle([...config.places]).slice(0, config.sparse);
    return chosen.map((p): PlacePart => [rng.int(1, 9), p]).sort(byValue);
  }
  return config.places.map((p, i): PlacePart => [rng.int(i === 0 || noZeros ? 1 : 0, 9), p]);
}

export function placeValueByDifficulty(rng: Rng, difficulty: Difficulty, config: PlaceValueConfig): GeneratedTask {
  const { max } = config;
  return byDifficulty(difficulty, {
    easy: () => placeValueTask(sample(rng, (r) => drawParts(r, config), (p) => sumOf(p) < max), max),
    medium: () => {
      const parts = sample(rng, (r) => drawParts(r, config, true), (p) => sumOf(p) < max);
      if (!config.sparse && rng.chance(0.5)) {
        // Stellenwerte als Zahlen: 400 + 7 + 30
        const values = sample(rng, (r) => r.shuffle(parts.map(([c, p]) => c * PLACE_VALUE[p])), (v) => v[0] !== parts[0][0] * PLACE_VALUE[parts[0][1]]);
        const total = sumOf(parts);
        return integerTask({
          prompt: expr(...values.flatMap((v, i) => (i ? [PLUS, v] : [v])), '=', '?'),
          answer: total,
          // Ziffern in der gezeigten Reihenfolge: 400 + 7 + 30 → 473
          distractors: [Number(values.map((v) => digitsOf(v)[0]).join('')), total + 10, total - 10, total + 1],
          explanation: [
            parts.map(([c, p]) => `${expr(c * PLACE_VALUE[p])} sind ${c} ${p}`).join(', '),
            expr(...parts.flatMap(([c, p], i) => (i ? [PLUS, c * PLACE_VALUE[p]] : [c * PLACE_VALUE[p]])), '=', total),
          ],
          max,
        });
      }
      // Reihenfolge durcheinander: 7 E + 3 H + 4 Z
      return placeValueTask(sample(rng, (r) => r.shuffle(parts), (p) => p[0][1] !== parts[0][1]), max);
    },
    hard: () => {
      // Bündeln: eine kleinere Stelle hat 10 bis 19 (4 H + 13 Z + 5 E)
      const parts = sample(
        rng,
        (r) => {
          const drawn = drawParts(r, config);
          const j = r.int(1, drawn.length - 1);
          return drawn.map(([c, p], i): PlacePart => [i === j ? r.int(10, 19) : c, p]);
        },
        (p) => sumOf(p) < max,
      );
      const total = sumOf(parts);
      if (rng.chance(0.4)) {
        // Wie viele der höchsten Stelle fehlen? □ H + 13 Z + 5 E = 535
        const [[top, place], ...rest] = parts;
        const restSum = sumOf(rest);
        return integerTask({
          prompt: `${BOX} ${place} + ${rest.map(([c, p]) => `${c} ${p}`).join(' + ')} = ${expr(total)}`,
          answer: top,
          // erste Ziffer des Ergebnisses abgelesen, ohne an das Bündeln zu denken
          distractors: [Math.floor(total / PLACE_VALUE[place]), top + 1, top - 1, top + 2],
          explanation: [
            `${rest.map(([c, p]) => `${c} ${p}`).join(' + ')} = ${expr(restSum)}`,
            expr(total, MINUS, restSum, '=', top * PLACE_VALUE[place]),
            `${expr(top * PLACE_VALUE[place])} sind ${top} ${place}`,
          ],
          max: 9,
        });
      }
      return placeValueTask(parts, max);
    },
  });
}

// ---- Nachbarzahlen ------------------------------------------------------------------------------------

/** „Der Nachfolger von 399 ist ?“ */
export function successorTask(n: number, successor: boolean, max: number): GeneratedTask {
  const answer = successor ? n + 1 : n - 1;
  return integerTask({
    prompt: `Der ${successor ? 'Nachfolger' : 'Vorgänger'} von ${expr(n)} ist ?`,
    answer,
    // falsche Richtung, Zehner statt Einer
    distractors: successor ? [n - 1, n + 2, n + 10, answer - 10, answer + 100] : [n + 1, n - 2, n - 10, answer + 10, answer - 100],
    explanation: [successor ? `Der Nachfolger ist um 1 größer: ${expr(n, PLUS, 1, '=', answer)}` : `Der Vorgänger ist um 1 kleiner: ${expr(n, MINUS, 1, '=', answer)}`],
    max,
  });
}

/** Zahl für Vorgänger/Nachfolger – oft an einer Grenze (39 → 40, 399 → 400), wo Kinder stolpern. */
export function successorByBoundary(rng: Rng, max: number): GeneratedTask {
  const successor = rng.chance(0.5);
  const place = max >= 1000 ? rng.pick([10, 100]) : 10;
  const n = rng.chance(0.5)
    ? sample(rng, (r) => r.int(1, Math.floor(max / place) - 1) * place + (successor ? -1 : 0), (n) => n > 1 && n < max)
    : rng.int(2, max - 2);
  return successorTask(n, successor, max);
}

/** Nachbarzehner bzw. -hunderter: „? < 347 < 350“ */
export function neighborTask(rng: Rng, place: 10 | 100, min: number, max: number): GeneratedTask {
  const n = sample(rng, (r) => r.int(min, max - 1), (n) => n % place !== 0);
  const lower = Math.floor(n / place) * place;
  const upper = lower + place;
  const askLower = rng.chance(0.5);
  const answer = askLower ? lower : upper;
  const other = place === 10 ? 100 : 10;
  return integerTask({
    instruction: place === 10 ? 'Nachbarzehner' : 'Nachbarhunderter',
    prompt: askLower ? `? < ${expr(n)} < ${expr(upper)}` : `${expr(lower)} < ${expr(n)} < ?`,
    answer,
    // andere Seite, falscher Abstand, falsche Stelle (Zehner statt Hunderter)
    distractors: [
      askLower ? upper : lower,
      askLower ? lower - place : upper + place,
      askLower ? n - 1 : n + 1,
      askLower ? Math.floor(n / other) * other : Math.ceil(n / other) * other,
    ],
    explanation: [`Die ${place === 10 ? 'Zehner' : 'Hunderter'} links und rechts von ${expr(n)} sind ${expr(lower)} und ${expr(upper)}.`, `${expr(lower)} < ${expr(n)} < ${expr(upper)}`],
    max,
  });
}

/** „14 < ? < 16“ – die Zahl dazwischen */
export function betweenTask(rng: Rng, max: number): GeneratedTask {
  const left = rng.int(1, max - 2);
  const answer = left + 1;
  return integerTask({
    instruction: 'Welche Zahl liegt dazwischen?',
    prompt: `${expr(left)} < ? < ${expr(left + 2)}`,
    answer,
    distractors: [left, left + 2, left - 1, left + 3],
    explanation: [`Nach ${expr(left)} kommt ${expr(answer)}, dann ${expr(left + 2)}.`],
    max,
  });
}

/** „40 < ? < 50“ – genau in der Mitte zwischen zwei Zehnerzahlen */
export function middleTask(rng: Rng, max: number): GeneratedTask {
  const [left, right] = sample(rng, (r) => {
    const l = r.int(0, max / 10 - 1) * 10;
    return [l, l + r.pick([10, 20])];
  }, ([, r]) => r <= max);
  const answer = (left + right) / 2;
  const gap = right - left;
  return integerTask({
    instruction: 'Welche Zahl liegt genau in der Mitte?',
    prompt: `${expr(left)} < ? < ${expr(right)}`,
    answer,
    // um eins verrutscht, zu weit, die Hälfte des Abstands statt der Mitte
    distractors: [answer - 1, answer + 1, answer + 5, gap / 2, answer - 5],
    explanation: [`Von ${expr(left)} bis ${expr(right)} sind es ${gap}.`, `Die Hälfte davon ist ${gap / 2}.`, expr(left, PLUS, gap / 2, '=', answer)],
    max,
  });
}

// ---- Vergleichen ------------------------------------------------------------------------------------------

export const RELATIONS = ['<', '>', '='] as const;
export const RELATION_WORDS: Record<(typeof RELATIONS)[number], string> = {
  '<': 'ist kleiner als',
  '>': 'ist größer als',
  '=': 'ist gleich',
};

export interface CompareConfig {
  readonly min: number;
  readonly max: number;
  /** Kleinste Einheit der zweiten Zahl in „a + b ○ c“, z. B. 1 000 in Kl. 4 (300 000 + 45 000) */
  readonly step: number;
}

/** „347 ○ 374“: einfach – verschiedene höchste Stelle, mittel – gleiche höchste Stelle, schwer – Rechnung auf einer Seite. */
export function compareTask(rng: Rng, difficulty: Difficulty, { min, max, step }: CompareConfig): GeneratedTask {
  const lead = 10 ** (String(max - 1).length - 1);
  const equal = rng.chance(difficulty === 'hard' ? 0.25 : 0.12);
  let leftText: string;
  let left: number;
  let right: number;
  const explanation: string[] = [];
  if (difficulty === 'hard') {
    const add = rng.chance(0.5);
    const [a, b] = add
      ? sample(rng, (r) => [r.int(1, 8) * lead, step * r.int(1, lead / step - 1)], ([a, b]) => a + b < max)
      : sample(rng, (r) => [r.int(2, 9) * lead, step * r.int(1, lead / step - 1)], ([a, b]) => a - b > lead / 2);
    left = add ? a + b : a - b;
    leftText = expr(a, add ? PLUS : MINUS, b);
    explanation.push(expr(a, add ? PLUS : MINUS, b, '=', left));
    right = equal ? left : sample(rng, (r) => left + r.pick([-2, -1, 1, 2]) * step * r.pick([1, 10]), (v) => v >= min && v < max && v !== left);
  } else {
    left = rng.int(Math.max(min, lead), max - 1);
    const head = (v: number) => Math.floor(v / lead);
    if (equal) {
      right = left;
    } else if (difficulty === 'easy') {
      right = sample(rng, (r) => r.int(Math.max(min, lead), max - 1), (v) => head(v) !== head(left));
    } else {
      // gleiche höchste Stelle: die letzten zwei Ziffern vertauscht (347 ○ 374) oder eine Stelle knapp daneben
      const digits = digitsOf(left);
      const [y, z] = digits.slice(-2);
      right =
        y !== z && rng.chance(0.4)
          ? Number([...digits.slice(0, -2), z, y].join(''))
          : sample(rng, (r) => left + r.int(-9, 9) * 10 ** r.int(0, digits.length - 2), (v) => v !== left && head(v) === head(left) && v < max);
    }
    leftText = expr(left);
  }
  const relation = left < right ? '<' : left > right ? '>' : '=';
  explanation.push(`${expr(left)} ${RELATION_WORDS[relation]} ${expr(right)}`);
  const toAnswer = (r: string) => textAnswer(plain(r), r);
  return {
    prompt: { instruction: 'Welches Zeichen passt?', math: plain(`${leftText} ○ ${expr(right)}`) },
    answer: toAnswer(relation),
    distractors: RELATIONS.filter((r) => r !== relation).map(toAnswer),
    explanation: explanation.map(plain),
  };
}

// ---- Ergänzen --------------------------------------------------------------------------------------------

/** „457 + □ = 500“ mit Rechenweg über die nächsten glatten Zahlen */
export function completeTask(n: number, target: number, max: number): GeneratedTask {
  const missing = target - n;
  const steps: [number, number][] = [];
  let at = n;
  for (let place = 10; place < target; place *= 10) {
    const next = Math.ceil(at / place) * place;
    if (next > at && next <= target) {
      steps.push([at, next]);
      at = next;
    }
  }
  if (at < target) steps.push([at, target]);
  // jede Stelle auf 10 ergänzt (1 000 − 376 → 734, 100 − 37 → 73) – nur bei glatten Zielen wie 100 oder 1 000
  const digits = digitsOf(n);
  const fillToTen = String(target) === `1${'0'.repeat(digits.length)}` ? digits.reduce((sum, d, i) => sum + (10 - d) * 10 ** (digits.length - 1 - i), 0) : missing + 100;
  return integerTask({
    prompt: expr(n, PLUS, BOX, '=', target),
    answer: missing,
    distractors: [fillToTen, subtractWithoutBorrow(target, n), subtractSmallerDigit(target, n), missing + 10, missing - 10, missing + 1],
    explanation: [
      ...steps.map(([from, to]) => expr(from, PLUS, to - from, '=', to)),
      ...(steps.length > 1 ? [expr(...steps.flatMap(([from, to], i) => (i ? [PLUS, to - from] : [to - from])), '=', missing)] : []),
    ],
    max,
  });
}
