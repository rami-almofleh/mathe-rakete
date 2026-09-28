import { Difficulty, Grade, Operation } from '../models';

/** Ein Thema auf einer bestimmten Stufe, z. B. „Kleines Einmaleins, mittel“. */
export interface TopicLevel {
  readonly topicId: string;
  readonly difficulty: Difficulty;
}

type Plan = Partial<Record<Grade, Partial<Record<Operation, Record<Difficulty, readonly TopicLevel[]>>>>>;

const level = (topicId: string, difficulty: Difficulty): TopicLevel => ({ topicId, difficulty });

/**
 * Modus „Rechnen“ in der Grundschule: Was ein Kind der Klasse bei jeder Rechenart und
 * Schwierigkeit übt. „Einfach“ beginnt immer mit dem, was am Anfang der Klasse sicher
 * sitzt (oft Stoff vom Ende der Vorklasse) – „schwer“ ist der Stoff am Ende der Klasse.
 *
 * Beispiel Kl. 3 „·“: einfach = kleines Einmaleins (bis 10 · 10), mittel = kleines
 * Einmaleins + Zehnereinmaleins (7 · 40), schwer = Zehnereinmaleins + halbschriftlich (47 · 8).
 *
 * Ab Kl. 5 gilt die allgemeine Regel (Themen der Klasse, gewählte Schwierigkeit).
 */
export const ARITHMETIC_PLAN: Plan = {
  1: {
    add: {
      easy: [level('k1-add-10', 'easy'), level('k1-add-10', 'medium')],
      medium: [level('k1-add-10', 'medium'), level('k1-add-20', 'easy')],
      hard: [level('k1-add-20', 'medium'), level('k1-add-20', 'hard'), level('k1-missing', 'hard')],
    },
    sub: {
      easy: [level('k1-sub-10', 'easy'), level('k1-sub-10', 'medium')],
      medium: [level('k1-sub-10', 'medium'), level('k1-sub-20', 'easy')],
      hard: [level('k1-sub-20', 'medium'), level('k1-sub-20', 'hard'), level('k1-missing', 'hard')],
    },
  },
  2: {
    add: {
      easy: [level('k1-add-20', 'medium'), level('k2-add-100', 'easy')],
      medium: [level('k2-add-100', 'easy'), level('k2-add-100', 'medium')],
      hard: [level('k2-add-100', 'medium'), level('k2-add-100', 'hard')],
    },
    sub: {
      easy: [level('k1-sub-20', 'medium'), level('k2-sub-100', 'easy')],
      medium: [level('k2-sub-100', 'easy'), level('k2-sub-100', 'medium')],
      hard: [level('k2-sub-100', 'medium'), level('k2-sub-100', 'hard')],
    },
    mul: {
      easy: [level('k2-times-table', 'easy')],
      medium: [level('k2-times-table', 'easy'), level('k2-times-table', 'medium')],
      hard: [level('k2-times-table', 'medium'), level('k2-times-table', 'hard')],
    },
    div: {
      easy: [level('k2-div', 'easy')],
      medium: [level('k2-div', 'easy'), level('k2-div', 'medium')],
      hard: [level('k2-div', 'medium'), level('k2-div', 'hard')],
    },
  },
  3: {
    add: {
      easy: [level('k2-add-100', 'hard'), level('k3-add-1000', 'easy')],
      medium: [level('k3-add-1000', 'easy'), level('k3-add-1000', 'medium')],
      hard: [level('k3-add-1000', 'medium'), level('k3-add-1000', 'hard')],
    },
    sub: {
      easy: [level('k2-sub-100', 'hard'), level('k3-sub-1000', 'easy')],
      medium: [level('k3-sub-1000', 'easy'), level('k3-sub-1000', 'medium')],
      hard: [level('k3-sub-1000', 'medium'), level('k3-sub-1000', 'hard')],
    },
    mul: {
      easy: [level('k2-times-table', 'medium'), level('k2-times-table', 'hard')],
      medium: [level('k2-times-table', 'hard'), level('k3-times-tens', 'easy')],
      hard: [level('k3-times-tens', 'medium'), level('k3-times-tens', 'hard')],
    },
    div: {
      easy: [level('k2-div', 'medium'), level('k2-div', 'hard')],
      medium: [level('k2-div', 'hard'), level('k3-div-remainder', 'easy')],
      hard: [level('k3-div-remainder', 'medium'), level('k3-div-remainder', 'hard')],
    },
  },
  4: {
    add: {
      easy: [level('k3-add-1000', 'hard'), level('k4-written-add-sub', 'easy')],
      medium: [level('k4-written-add-sub', 'easy'), level('k4-written-add-sub', 'medium')],
      hard: [level('k4-written-add-sub', 'medium'), level('k4-written-add-sub', 'hard')],
    },
    sub: {
      easy: [level('k3-sub-1000', 'hard'), level('k4-written-add-sub', 'easy')],
      medium: [level('k4-written-add-sub', 'easy'), level('k4-written-add-sub', 'medium')],
      hard: [level('k4-written-add-sub', 'medium'), level('k4-written-add-sub', 'hard')],
    },
    mul: {
      easy: [level('k3-times-tens', 'medium'), level('k3-times-tens', 'hard')],
      medium: [level('k3-times-tens', 'hard'), level('k4-written-mul', 'easy')],
      hard: [level('k4-written-mul', 'medium'), level('k4-written-mul', 'hard')],
    },
    div: {
      easy: [level('k3-div-remainder', 'hard'), level('k4-written-div', 'easy')],
      medium: [level('k4-written-div', 'easy'), level('k4-written-div', 'medium')],
      hard: [level('k4-written-div', 'medium'), level('k4-written-div', 'hard')],
    },
  },
};
