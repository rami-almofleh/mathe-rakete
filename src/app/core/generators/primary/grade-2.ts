import { plain } from '../../models';
import { numberAnswer, textAnswer } from '../answers';
import { GeneratedTask, TaskGenerator } from '../generator';
import { additionTask, divisionTask, multiplicationTask, subtractionTask } from './arithmetic';
import {
  borrowCount,
  BOX,
  byDifficulty,
  carryCount,
  DIVIDED,
  explainTimesTable,
  expr,
  generator,
  integerTask,
  MINUS,
  pickOperation,
  PLUS,
  sample,
  TIMES,
} from './helpers';
import { getAndGive, getMore, getOff, groups, howManyMore, packs, wordProblemTask } from './word-problems';
import { compareTask, completeTask, middleTask, neighborTask, placeValueByDifficulty, successorByBoundary } from './number-sense';
import { bigToSmall, formatMixed, mixedToSmall, smallToBig, smallToMixed, unitTask, UNITS } from './units';

const MAX_100 = 100;
const CORE_FACTORS = [1, 2, 5, 10];

export const k2Add100 = generator('k2-add-100', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    // 30 + 40 · 34 + 5 · 34 + 20 (ohne Übergang)
    easy: () =>
      rng.pick([
        () => {
          const a = rng.int(1, 8);
          return additionTask(a * 10, rng.int(1, 9 - a) * 10, MAX_100);
        },
        () => {
          const a = sample(rng, (r) => r.int(11, 88), (n) => n % 10 < 9);
          return additionTask(a, rng.int(1, 9 - (a % 10)), MAX_100);
        },
        () => {
          const a = rng.int(11, 79);
          return additionTask(a, rng.int(1, 9 - Math.floor(a / 10)) * 10, MAX_100);
        },
      ])(),
    // 47 + 8 (Übergang) · 34 + 25 (ohne Übergang, zweistellig)
    medium: () =>
      rng.chance(0.5)
        ? (() => {
            const [a, b] = sample(rng, (r) => [r.int(11, 89), r.int(2, 9)], ([a, b]) => carryCount(a, b) > 0 && a + b <= MAX_100);
            return additionTask(a, b, MAX_100);
          })()
        : (() => {
            const [a, b] = sample(rng, (r) => [r.int(11, 79), r.int(11, 79)], ([a, b]) => carryCount(a, b) === 0 && a + b < MAX_100);
            return additionTask(a, b, MAX_100);
          })(),
    // 47 + 38 (Übergang bei den Einern)
    hard: () => {
      const [a, b] = sample(rng, (r) => [r.int(11, 89), r.int(11, 89)], ([a, b]) => (a % 10) + (b % 10) >= 10 && a + b <= MAX_100);
      return additionTask(a, b, MAX_100);
    },
  }),
);

export const k2Sub100 = generator('k2-sub-100', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    // 70 − 30 · 58 − 6 · 58 − 20 (ohne Übergang)
    easy: () =>
      rng.pick([
        () => {
          const a = rng.int(2, 10);
          return subtractionTask(a * 10, rng.int(1, a - 1) * 10, MAX_100);
        },
        () => {
          const a = sample(rng, (r) => r.int(11, 99), (n) => n % 10 > 0);
          return subtractionTask(a, rng.int(1, a % 10), MAX_100);
        },
        () => {
          const a = rng.int(21, 99);
          return subtractionTask(a, rng.int(1, Math.floor(a / 10) - 1) * 10, MAX_100);
        },
      ])(),
    // 52 − 7 (Übergang) · 58 − 23 (ohne Übergang)
    medium: () =>
      rng.chance(0.5)
        ? (() => {
            const [a, b] = sample(rng, (r) => [r.int(11, 99), r.int(2, 9)], ([a, b]) => borrowCount(a, b) > 0);
            return subtractionTask(a, b, MAX_100);
          })()
        : (() => {
            const [a, b] = sample(rng, (r) => [r.int(22, 99), r.int(11, 89)], ([a, b]) => a > b && borrowCount(a, b) === 0);
            return subtractionTask(a, b, MAX_100);
          })(),
    // 82 − 45
    hard: () => {
      const [a, b] = sample(rng, (r) => [r.int(21, 100), r.int(11, 89)], ([a, b]) => a - b >= 2 && borrowCount(a, b) > 0);
      return subtractionTask(a, b, MAX_100);
    },
  }),
);

export const k2TimesTable = generator('k2-times-table', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    // Kernaufgaben mit 1, 2, 5, 10
    easy: () => {
      const core = rng.pick(CORE_FACTORS);
      const other = rng.int(1, 10);
      return rng.chance(0.5) ? multiplicationTask(core, other, MAX_100) : multiplicationTask(other, core, MAX_100);
    },
    medium: () => multiplicationTask(rng.int(2, 10), rng.int(2, 10), MAX_100),
    hard: () => {
      const a = rng.int(6, 9);
      const b = rng.int(6, 9);
      if (rng.chance(0.5)) {
        return multiplicationTask(a, b, MAX_100);
      }
      // □ · b = c
      const product = a * b;
      return integerTask({
        prompt: expr(BOX, TIMES, b, '=', product),
        answer: a,
        // Nachbar in der Reihe, bekannten Faktor abgeschrieben
        distractors: [a + 1, a - 1, a + 2, b],
        explanation: [expr(BOX, '=', product, DIVIDED, b, '=', a), ...explainTimesTable(a, b)],
        max: MAX_100,
      });
    },
  }),
);

export const k2Div = generator('k2-div', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    easy: () => {
      const divisor = rng.pick([2, 5, 10]);
      return divisionTask(divisor * rng.int(1, 10), divisor, MAX_100);
    },
    medium: () => {
      const divisor = rng.int(2, 10);
      return divisionTask(divisor * rng.int(2, 10), divisor, MAX_100);
    },
    hard: () => {
      const divisor = rng.int(3, 9);
      const quotient = rng.int(3, 10);
      const dividend = divisor * quotient;
      return rng.chance(0.5)
        ? integerTask({
            // □ : 6 = 7
            prompt: expr(BOX, DIVIDED, divisor, '=', quotient),
            answer: dividend,
            distractors: [dividend + divisor, dividend - divisor, quotient + divisor, dividend + 1],
            explanation: [expr(BOX, '=', quotient, TIMES, divisor, '=', dividend)],
            max: MAX_100,
          })
        : integerTask({
            // 42 : □ = 7
            prompt: expr(dividend, DIVIDED, BOX, '=', quotient),
            answer: divisor,
            distractors: [divisor + 1, divisor - 1, divisor + 2, quotient],
            explanation: [expr(BOX, '=', dividend, DIVIDED, quotient, '=', divisor) + `, denn ${expr(quotient, TIMES, divisor, '=', dividend)}`],
            max: MAX_100,
          });
    },
  }),
);

export const k2Money = generator('k2-money', (context) => {
  const { difficulty, rng } = context;
  const op = pickOperation(context, ['add', 'sub']);
  const sys = UNITS.euroCt;
  const money = (ct: number) => formatMixed(ct, sys);

  const [a, b] = byDifficulty(difficulty, {
    // 40 ct + 30 ct · 90 ct − 30 ct
    easy: () => sample(rng, (r) => [r.int(1, 9) * 10, r.int(1, 9) * 10], ([a, b]) => (op === 'add' ? a + b <= 100 : a > b)),
    // 45 ct + 35 ct · 1 € − 35 ct
    medium: () =>
      op === 'add'
        ? sample(rng, (r) => [r.int(1, 19) * 5, r.int(1, 19) * 5], ([a, b]) => a + b <= 100 && carryCount(a, b) > 0)
        : [100, rng.int(1, 19) * 5],
    // 2 € 50 ct + 1 € 80 ct · 5 € − 1 € 20 ct
    hard: () =>
      op === 'add'
        ? sample(rng, (r) => [r.int(11, 49) * 10, r.int(11, 49) * 10], ([a, b]) => (a % 100) + (b % 100) >= 100 && a + b <= 1000)
        : sample(rng, (r) => [r.int(2, 9) * 100, r.int(11, 49) * 10], ([a, b]) => a > b && b % 100 !== 0),
  });

  const result = op === 'add' ? a + b : a - b;
  const sign = op === 'add' ? PLUS : MINUS;
  const distractors = [result + 10, result - 10, result + 5, result - 5];
  if (op === 'add' && (a % 100) + (b % 100) >= 100) {
    distractors.push(result - 100); // Übertrag 100 ct = 1 € vergessen
  }
  if (op === 'sub' && a % 100 < b % 100) {
    distractors.push(result + 100); // 5 € − 1 € 20 ct → 4 € 80 ct (Euro nicht entbündelt)
  }
  if (op === 'sub' && a % 100 === 0) {
    distractors.push(subtractDigitwise(a, b));
  }
  return unitTask({
    prompt: `${money(a)} ${sign} ${money(b)} = ?`,
    sys,
    answer: result,
    distractors,
    display: (t) => money(t.num / t.den),
    explanation:
      Math.max(a, b, result) < 100
        ? [`${expr(a, sign, b, '=', result)} ct`]
        : [`1 € = 100 ct`, `${money(a)} ${sign} ${money(b)} = ${expr(a, sign, b, '=', result)} ct`, `${expr(result)} ct = ${money(result)}`],
  });
});

/** Fehler bei 1 € − 35 ct: „10 − 3 = 7, 5 − 0 = 5“ → 75 ct. */
function subtractDigitwise(a: number, b: number): number {
  const tens = Math.floor(b / 10) % 10;
  const ones = b % 10;
  return Math.max(0, Math.floor(a / 100) * 100 - 100 + (10 - tens) * 10 + ones);
}

export const k2Length = generator('k2-length', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    easy: () => (rng.chance(0.5) ? bigToSmall(UNITS.mCm, rng, 9) : smallToBig(UNITS.mCm, rng, 9)),
    medium: () => mixedToSmall(UNITS.mCm, rng, 9),
    hard: () => smallToMixed(UNITS.mCm, rng, 9, false),
  }),
);

// ---- Zahlen bis 100 ----------------------------------------------------------------------------

export const k2PlaceValue = generator('k2-place-value', ({ difficulty, rng }) =>
  placeValueByDifficulty(rng, difficulty, { places: ['Z', 'E'], max: MAX_100 }),
);

export const k2Neighbors = generator('k2-neighbors', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    // Vorgänger und Nachfolger, gern an der Zehnergrenze (39 → 40)
    easy: () => successorByBoundary(rng, MAX_100),
    // ? < 47 < 50
    medium: () => neighborTask(rng, 10, 11, MAX_100),
    // 40 < ? < 50 – genau in der Mitte
    hard: () => middleTask(rng, MAX_100),
  }),
);

export const k2Compare = generator('k2-compare', ({ difficulty, rng }) => compareTask(rng, difficulty, { min: 10, max: MAX_100, step: 1 }));

export const k2Complete = generator('k2-complete', ({ difficulty, rng }) => {
  const [n, target] = byDifficulty<[number, number]>(difficulty, {
    // bis zum nächsten Zehner: 37 + □ = 40
    easy: () => {
      const n = sample(rng, (r) => r.int(11, 98), (n) => n % 10 !== 0);
      return [n, Math.ceil(n / 10) * 10];
    },
    // Fünferzahl bis 100: 35 + □ = 100
    medium: () => [5 * rng.pick([3, 5, 7, 9, 11, 13, 15, 17, 19]), MAX_100],
    // beliebig bis 100 oder bis zu einem späteren Zehner: 37 + □ = 60
    hard: () => {
      const n = sample(rng, (r) => r.int(11, 88), (n) => n % 5 !== 0);
      const firstTen = Math.ceil(n / 10) + 1;
      return [n, firstTen > 9 || rng.chance(0.5) ? MAX_100 : rng.int(firstTen, 9) * 10];
    },
  });
  return completeTask(n, target, MAX_100);
});

// ---- Kalender -----------------------------------------------------------------------------------

export const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'] as const;
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'] as const;
/** Februar fehlt bewusst – 28 oder 29 Tage wäre keine eindeutige Frage */
const DAYS_IN_MONTH: Readonly<Record<string, number>> = {
  Januar: 31, März: 31, April: 30, Mai: 31, Juni: 30, Juli: 31, August: 31, September: 30, Oktober: 31, November: 30, Dezember: 31,
};

const wrap = (i: number, n: number) => ((i % n) + n) % n;
const nameAnswer = (name: string) => textAnswer(plain(name), name);

/** Antwort ist ein Wochentag/Monat; Ablenker: einen zu viel/wenig gezählt (heute mitgezählt), falsche Richtung. */
function cyclicTask(list: readonly string[], from: number, steps: number, question: string, explanation: string[]): GeneratedTask {
  const answer = list[wrap(from + steps, list.length)];
  return {
    prompt: { math: plain(question) },
    answer: nameAnswer(answer),
    distractors: [steps + 1, steps - 1, -steps, steps + 2].map((k) => list[wrap(from + k, list.length)]).filter((n) => n !== answer).map(nameAnswer),
    explanation: explanation.map(plain),
  };
}

/** „Montag → Dienstag → Mittwoch“ – bei mehr als einer Woche erst ganze Wochen überspringen */
function countAlong(list: readonly string[], from: number, steps: number, unit: string): string[] {
  const lines: string[] = [];
  const dir = Math.sign(steps);
  let at = from;
  let left = Math.abs(steps);
  if (left >= list.length) {
    const rounds = Math.floor(left / list.length);
    lines.push(`${rounds * list.length} ${unit} ${dir > 0 ? 'später' : 'früher'} ist wieder ${list[from]}.`);
    left -= rounds * list.length;
  }
  if (left) {
    const chain = Array.from({ length: left + 1 }, (_, i) => list[wrap(at + dir * i, list.length)]);
    lines.push(chain.join(' → '));
    at += dir * left;
  }
  return lines;
}

export const k2Calendar = generator('k2-calendar', ({ difficulty, rng }) =>
  byDifficulty(difficulty, {
    // Welcher Tag/Monat kommt nach/vor …?
    easy: () => {
      const months = rng.chance(0.4);
      const list = months ? MONTHS : WEEKDAYS;
      const from = rng.int(0, list.length - 1);
      const after = rng.chance(0.6);
      return cyclicTask(
        list,
        from,
        after ? 1 : -1,
        `Welcher ${months ? 'Monat' : 'Tag'} kommt ${after ? 'nach' : 'vor'} ${list[from]}?`,
        countAlong(list, from, after ? 1 : -1, months ? 'Monate' : 'Tage'),
      );
    },
    // Heute ist Montag. Welcher Tag ist in 3 Tagen?
    medium: () => {
      const from = rng.int(0, 6);
      const steps = rng.int(2, 6) * (rng.chance(0.7) ? 1 : -1);
      return cyclicTask(
        WEEKDAYS,
        from,
        steps,
        steps > 0 ? `Heute ist ${WEEKDAYS[from]}. Welcher Tag ist in ${steps} Tagen?` : `Heute ist ${WEEKDAYS[from]}. Welcher Tag war vor ${-steps} Tagen?`,
        countAlong(WEEKDAYS, from, steps, 'Tage'),
      );
    },
    // über eine Woche hinaus, Monate weiterzählen, Tage eines Monats
    hard: () => {
      const kind = rng.pick(['days', 'months', 'length'] as const);
      if (kind === 'days') {
        const from = rng.int(0, 6);
        const steps = rng.int(8, 20);
        return cyclicTask(WEEKDAYS, from, steps, `Heute ist ${WEEKDAYS[from]}. Welcher Tag ist in ${steps} Tagen?`, countAlong(WEEKDAYS, from, steps, 'Tage'));
      }
      if (kind === 'months') {
        const from = rng.int(0, 11);
        const steps = rng.int(2, 6);
        return cyclicTask(MONTHS, from, steps, `Welcher Monat ist ${steps} Monate nach ${MONTHS[from]}?`, countAlong(MONTHS, from, steps, 'Monate'));
      }
      const month = rng.pick(Object.keys(DAYS_IN_MONTH));
      const days = DAYS_IN_MONTH[month];
      return {
        prompt: { math: plain(`Wie viele Tage hat der ${month}?`) },
        answer: numberAnswer(days),
        distractors: [days === 31 ? 30 : 31, 28, 29, 7].map((d) => numberAnswer(d)),
        explanation: [
          plain('31 Tage haben: Januar, März, Mai, Juli, August, Oktober, Dezember (Knöchel-Regel).'),
          plain(`Der ${month} hat ${days} Tage.`),
        ],
      };
    },
  }),
);

export const k2WordProblems = generator('k2-word-problems', ({ difficulty, rng }) =>
  wordProblemTask(
    rng,
    byDifficulty(difficulty, {
      easy: () => [getMore(50, false), getOff(50)],
      medium: () => [getMore(MAX_100, true), getOff(MAX_100), howManyMore(MAX_100), packs(10), groups(10)],
      hard: () => [getAndGive(MAX_100), howManyMore(MAX_100), packs(10), groups(10)],
    }),
    MAX_100,
  ),
);

export const GRADE_2_GENERATORS: readonly TaskGenerator[] = [
  k2PlaceValue,
  k2Neighbors,
  k2Compare,
  k2Add100,
  k2Sub100,
  k2Complete,
  k2TimesTable,
  k2Div,
  k2Money,
  k2Length,
  k2Calendar,
  k2WordProblems,
];
