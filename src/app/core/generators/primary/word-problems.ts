import { Rational } from '../../math/rational';
import { Rng } from '../../math/rng';
import { numberAnswer } from '../answers';
import { GeneratedTask } from '../generator';
import { quantityFormat } from '../task-helpers';
import { carryCount, DIVIDED, expr, integerTask, MINUS, PLUS, sample, TIMES } from './helpers';

/**
 * Sachaufgaben aus Textbausteinen. Jede Vorlage kennt ihre Rechnung und die typischen Fehler:
 * falsche Rechenart (plus statt minus), bei zweischrittigen Aufgaben einen Schritt vergessen.
 * Die Mathematik steckt im Text – das Kind muss herauslesen, was gerechnet wird.
 */

const NAMES = ['Lena', 'Tim', 'Mia', 'Ben', 'Emma', 'Noah', 'Ali', 'Sofia', 'Paul', 'Lea', 'Jonas', 'Hannah'] as const;
const ITEMS = ['Murmeln', 'Sticker', 'Sammelkarten', 'Perlen', 'Muscheln'] as const;

type Unit = '' | '€' | 'm' | 'kg';

interface Story {
  readonly text: string;
  readonly answer: number;
  readonly distractors: readonly number[];
  readonly explanation: readonly string[];
  readonly unit?: Unit;
}

export type Template = (rng: Rng) => Story;

function storyTask(story: Story, max: number): GeneratedTask {
  const unit = story.unit ?? '';
  const format = unit ? (n: number) => quantityFormat(unit)(Rational.of(n)) : (n: number) => numberAnswer(n);
  return integerTask({
    prompt: story.text,
    answer: story.answer,
    distractors: story.distractors,
    explanation: story.explanation,
    format,
    max,
  });
}

export function wordProblemTask(rng: Rng, templates: readonly Template[], max: number): GeneratedTask {
  return storyTask(rng.pick(templates)(rng), max);
}

const name = (rng: Rng) => rng.pick(NAMES);
const twoNames = (rng: Rng) => {
  const [a, b] = rng.shuffle([...NAMES]);
  return [a, b] as const;
};

// ---- Klasse 2 (bis 100) ------------------------------------------------------------------------

/** Dazubekommen: a + b */
export const getMore =
  (max: number, carry: boolean): Template =>
  (rng) => {
    const n = name(rng);
    const item = rng.pick(ITEMS);
    const [a, b] = sample(rng, (r) => [r.int(11, max - 10), r.int(5, max - 20)], ([a, b]) => a + b <= max && (carryCount(a, b) > 0) === carry);
    return {
      text: `${n} hat ${expr(a)} ${item}. ${n} bekommt ${expr(b)} dazu. Wie viele ${item} hat ${n} jetzt?`,
      answer: a + b,
      // minus statt plus, verrechnet
      distractors: [a - b, a + b + 10, a + b - 10, a + b + 1],
      explanation: [`Es kommen ${expr(b)} dazu: ${expr(a, PLUS, b, '=', a + b)}`, `${n} hat jetzt ${expr(a + b)} ${item}.`],
    };
  };

/** Aussteigen: a − b */
export const getOff =
  (max: number): Template =>
  (rng) => {
    const [a, b] = sample(rng, (r) => [r.int(20, max), r.int(5, max - 10)], ([a, b]) => a - b >= 3);
    return {
      text: `Im Bus sitzen ${expr(a)} Kinder. An der Haltestelle steigen ${expr(b)} Kinder aus. Wie viele Kinder sitzen jetzt noch im Bus?`,
      answer: a - b,
      // plus statt minus
      distractors: [a + b, a - b + 10, a - b - 10, a - b + 1],
      explanation: [`Es steigen Kinder aus, also minus: ${expr(a, MINUS, b, '=', a - b)}`],
    };
  };

/** Vergleichen: „Wie viele mehr?“ = a − b */
export const howManyMore =
  (max: number): Template =>
  (rng) => {
    const [n, m] = twoNames(rng);
    const item = rng.pick(ITEMS);
    const [a, b] = sample(rng, (r) => [r.int(20, max), r.int(5, max - 5)], ([a, b]) => a - b >= 3);
    return {
      text: `${n} hat ${expr(a)} ${item}, ${m} hat ${expr(b)} ${item}. Wie viele ${item} hat ${n} mehr als ${m}?`,
      answer: a - b,
      // „mehr“ verführt zum Plusrechnen; eine der Zahlen abgeschrieben
      distractors: [a + b, a, b, a - b + 10],
      explanation: [`Unterschied: ${expr(a, MINUS, b, '=', a - b)}`, `${n} hat ${expr(a - b)} ${item} mehr.`],
    };
  };

/** Packungen: a · b */
export const packs =
  (maxFactor: number): Template =>
  (rng) => {
    const item = rng.pick(['Eier', 'Stifte', 'Kekse', 'Brötchen']);
    const [a, b] = [rng.int(2, maxFactor), rng.int(2, maxFactor)];
    return {
      text: `In einer Packung sind ${a} ${item}. Wie viele ${item} sind in ${b} Packungen?`,
      answer: a * b,
      // plus statt mal, eine Packung zu viel/wenig
      distractors: [a + b, a * (b + 1), a * (b - 1), a * b + 1],
      explanation: [`${b} Packungen mit je ${a} ${item}: ${expr(b, TIMES, a, '=', a * b)}`],
    };
  };

/** Gruppen bilden: a : b */
export const groups =
  (maxFactor: number): Template =>
  (rng) => {
    const [size, count] = [rng.int(2, Math.min(maxFactor, 6)), rng.int(2, maxFactor)];
    const total = size * count;
    return {
      text: `${total} Kinder bilden Gruppen zu je ${size} Kindern. Wie viele Gruppen gibt es?`,
      answer: count,
      // minus statt geteilt, eine Gruppe verzählt
      distractors: [total - size, count + 1, count - 1, size],
      explanation: [`${expr(total, DIVIDED, size, '=', count)}, denn ${expr(count, TIMES, size, '=', total)}`],
    };
  };

/** Zwei Schritte: a + b − c */
export const getAndGive =
  (max: number): Template =>
  (rng) => {
    const n = name(rng);
    const item = rng.pick(ITEMS);
    const [a, b, c] = sample(rng, (r) => [r.int(10, max - 20), r.int(5, 40), r.int(5, 40)], ([a, b, c]) => a + b <= max && a + b - c >= 3);
    return {
      text: `${n} hat ${expr(a)} ${item}, bekommt ${expr(b)} dazu und verschenkt dann ${expr(c)}. Wie viele ${item} hat ${n} am Ende?`,
      answer: a + b - c,
      // nur den ersten Schritt, nur den zweiten Schritt, alles addiert
      distractors: [a + b, a - c, a + b + c, a + b - c + 10],
      explanation: [expr(a, PLUS, b, '=', a + b), expr(a + b, MINUS, c, '=', a + b - c)],
    };
  };

// ---- Klasse 3 (bis 1 000) ------------------------------------------------------------------------

/** Rückgeld: b − a */
export const change: Template = (rng) => {
  const n = name(rng);
  const thing = rng.pick(['Fahrrad', 'Roller', 'Zelt', 'Fußballtor']);
  const paid = rng.pick([100, 200, 300, 500, 1000]);
  const price = sample(rng, (r) => r.int(paid / 2, paid - 3), (p) => p % 10 !== 0);
  return {
    text: `Ein ${thing} kostet ${expr(price)} €. ${n} bezahlt mit ${expr(paid)} €. Wie viel Rückgeld bekommt ${n}?`,
    answer: paid - price,
    unit: '€',
    // plus gerechnet, beim Ergänzen verzählt
    distractors: [paid + price, paid - price + 10, paid - price - 10, paid - price + 1],
    explanation: [`Rückgeld = bezahlt − Preis`, expr(paid, MINUS, price, '=', paid - price) + ' €'],
  };
};

/** Zwei Schritte: Rückgeld nach Einkauf mehrerer Dinge: b − p · k */
export const changeForSeveral: Template = (rng) => {
  const n = name(rng);
  const thing = rng.pick([['Heft', 'Hefte'], ['Buch', 'Bücher'], ['Ball', 'Bälle']] as const);
  const [price, count] = [rng.int(3, 12), rng.int(2, 6)];
  const paid = sample(rng, (r) => r.pick([20, 50, 100]), (p) => p > price * count);
  const cost = price * count;
  return {
    text: `Ein ${thing[0]} kostet ${price} €. ${n} kauft ${count} ${thing[1]} und bezahlt mit ${paid} €. Wie viel Rückgeld bekommt ${n}?`,
    answer: paid - cost,
    unit: '€',
    // nur ein Stück bezahlt, nur den Preis ausgerechnet, plus statt mal
    distractors: [paid - price, cost, paid - price - count, paid - cost + 10],
    explanation: [`${count} ${thing[1]}: ${expr(count, TIMES, price, '=', cost)} €`, `Rückgeld: ${expr(paid, MINUS, cost, '=', paid - cost)} €`],
  };
};

/** Gleich große Gruppen zusammen: k · a */
export const classes: Template = (rng) => {
  const [k, a] = [rng.int(3, 9), rng.int(18, 29)];
  return {
    text: `In jeder der ${k} Klassen sind ${a} Kinder. Wie viele Kinder sind das zusammen?`,
    answer: k * a,
    // plus statt mal, eine Klasse zu wenig
    distractors: [k + a, k * (a - 1), (k - 1) * a, k * a + 10],
    explanation: [expr(k, TIMES, a, '=', k * a)],
  };
};

/** Verteilen: a : k */
export const share: Template = (rng) => {
  const [k, each] = sample(rng, (r) => [r.int(3, 9), r.int(12, 60)], ([k, e]) => k * e <= 600);
  const total = k * each;
  const fruit = rng.pick([['Äpfel', 'jeden Korb', 'Körbe'], ['Bücher', 'jedes Regal', 'Regale'], ['Stifte', 'jeden Becher', 'Becher']] as const);
  return {
    text: `${expr(total)} ${fruit[0]} werden gleichmäßig auf ${k} ${fruit[2]} verteilt. Wie viele ${fruit[0]} kommen in ${fruit[1]}?`,
    answer: each,
    // minus statt geteilt, verrechnet
    distractors: [total - k, each + 1, each - 1, each + 10],
    explanation: [`${expr(total, DIVIDED, k, '=', each)}, denn ${expr(each, TIMES, k, '=', total)}`],
  };
};

/** Restweg: a − b */
export const distanceLeft: Template = (rng) => {
  const n = name(rng);
  const total = rng.int(4, 9) * 100 + rng.pick([0, 50]);
  const done = sample(rng, (r) => r.int(110, total - 30), (d) => d % 10 === 0 && d % 100 !== 0);
  return {
    text: `Der Schulweg ist ${expr(total)} m lang. ${n} ist schon ${expr(done)} m gegangen. Wie viele Meter fehlen noch?`,
    answer: total - done,
    unit: 'm',
    // plus gerechnet, verrechnet
    distractors: [total + done, total - done + 100, total - done - 10, total - done + 10],
    explanation: [`Was fehlt: ${expr(total, MINUS, done, '=', total - done)} m`],
  };
};

/** Zusammen: a + b */
export const visitors =
  (min: number, max: number): Template =>
  (rng) => {
    const [a, b] = sample(rng, (r) => [r.int(min, max / 2), r.int(min, max / 2)], ([a, b]) => a !== b && carryCount(a, b) > 0);
    const place = rng.pick(['in den Zoo', 'ins Schwimmbad', 'ins Museum']);
    return {
      text: `Am Samstag kommen ${expr(a)} Besucher ${place}, am Sonntag ${expr(b)}. Wie viele Besucher sind es an beiden Tagen zusammen?`,
      answer: a + b,
      // minus statt plus, Übertrag vergessen
      distractors: [Math.abs(a - b), a + b - 10, a + b + 10, a + b - 100],
      explanation: [expr(a, PLUS, b, '=', a + b)],
    };
  };

// ---- Klasse 4 (bis 1 Million) ----------------------------------------------------------------------

/** Reihen mit je s Plätzen: r · s */
export const cinema: Template = (rng) => {
  const [r, s] = [rng.int(12, 35), rng.int(12, 28)];
  return {
    text: `Ein Kino hat ${r} Reihen mit je ${s} Plätzen. Wie viele Plätze hat das Kino?`,
    answer: r * s,
    // plus statt mal, eine Reihe vergessen, nur die Zehner multipliziert
    distractors: [r + s, (r - 1) * s, r * s + 10, Math.floor(r / 10) * 10 * s],
    explanation: [expr(r, TIMES, s, '=', r * s)],
  };
};

/** Säcke füllen: a : s */
export const sacks: Template = (rng) => {
  const s = rng.pick([5, 10, 25, 50]);
  const count = rng.int(12, 400);
  const total = s * count;
  return {
    text: `Ein Bauer erntet ${expr(total)} kg Kartoffeln und füllt sie in Säcke zu je ${s} kg. Wie viele Säcke werden voll?`,
    answer: count,
    // minus statt geteilt, Null vergessen bzw. zu viel
    distractors: [total - s, count * 10, Math.floor(count / 10), count + 1],
    explanation: [`${expr(total, DIVIDED, s, '=', count)}, denn ${expr(count, TIMES, s, '=', total)}`],
  };
};

/** Sparen: a · m */
export const saving: Template = (rng) => {
  const n = name(rng);
  const [a, m] = [rng.pick([15, 20, 25, 30, 35, 40, 45, 50]), rng.int(6, 24)];
  return {
    text: `${n} spart jeden Monat ${a} €. Wie viel Geld hat ${n} nach ${m} Monaten gespart?`,
    answer: a * m,
    unit: '€',
    // plus statt mal, einen Monat zu wenig
    distractors: [a + m, a * (m - 1), a * m + 10, a * (m + 1)],
    explanation: [expr(m, TIMES, a, '=', a * m) + ' €'],
  };
};

/** Preisnachlass: a − b */
export const discount: Template = (rng) => {
  const thing = rng.pick(['Auto', 'Motorrad', 'Wohnmobil', 'Boot']);
  const price = rng.int(80, 499) * 100 + rng.pick([0, 50]);
  const off = rng.int(5, 60) * 100 + rng.pick([0, 50]);
  return {
    text: `Ein ${thing} kostet ${expr(price)} €. Im Angebot ist es ${expr(off)} € billiger. Wie viel kostet es im Angebot?`,
    answer: price - off,
    unit: '€',
    // plus statt minus, Stelle verrutscht
    distractors: [price + off, price - off + 1000, price - off - 100, price - off + 100],
    explanation: [expr(price, MINUS, off, '=', price - off) + ' €'],
  };
};

/** Zwei Schritte: r · s − f */
export const seatsLeft: Template = (rng) => {
  const [r, s] = [rng.int(12, 30), rng.int(12, 24)];
  const seats = r * s;
  const sold = sample(rng, (x) => x.int(Math.floor(seats / 3), seats - 10), (f) => f % 10 !== 0);
  return {
    text: `Ein Kino hat ${r} Reihen mit je ${s} Plätzen. ${expr(sold)} Karten sind schon verkauft. Wie viele Plätze sind noch frei?`,
    answer: seats - sold,
    // nur die Plätze ausgerechnet, nur die Karten, falsch verknüpft
    distractors: [seats, seats + sold, r + s, seats - sold + 10],
    explanation: [`Plätze: ${expr(r, TIMES, s, '=', seats)}`, `Frei: ${expr(seats, MINUS, sold, '=', seats - sold)}`],
  };
};

/** Zwei Schritte: hin und zurück, an mehreren Tagen: 2 · a · d */
export const roundTrips: Template = (rng) => {
  const n = name(rng);
  const [a, d] = [rng.int(3, 25), rng.int(5, 20)];
  return {
    text: `${n} fährt jeden Tag ${a} km zur Arbeit und abends wieder zurück. Wie viele Kilometer sind das an ${d} Tagen?`,
    answer: 2 * a * d,
    // Rückweg vergessen, nur ein Tag, plus statt mal
    distractors: [a * d, 2 * a, 2 * a + d, 2 * a * d + 10],
    explanation: [`Ein Tag (hin und zurück): ${expr(2, TIMES, a, '=', 2 * a)} km`, `${d} Tage: ${expr(d, TIMES, 2 * a, '=', 2 * a * d)} km`],
  };
};
