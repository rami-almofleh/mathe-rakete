import { Grade } from './grade';

export type Operation = 'add' | 'sub' | 'mul' | 'div';

export interface OperationInfo {
  readonly id: Operation;
  readonly symbol: string;
  readonly label: string;
  readonly icon: string;
}

export const OPERATIONS: readonly OperationInfo[] = [
  { id: 'add', symbol: '+', label: 'Plus', icon: 'bi-plus-lg' },
  { id: 'sub', symbol: '−', label: 'Minus', icon: 'bi-dash-lg' },
  { id: 'mul', symbol: '·', label: 'Mal', icon: 'bi-x-lg' },
  { id: 'div', symbol: ':', label: 'Geteilt', icon: 'bi-slash-lg' },
];

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: readonly { id: Difficulty; label: string; icon: string }[] = [
  { id: 'easy', label: 'Einfach', icon: 'bi-emoji-smile-fill' },
  { id: 'medium', label: 'Mittel', icon: 'bi-emoji-sunglasses-fill' },
  { id: 'hard', label: 'Schwer', icon: 'bi-fire' },
];

/**
 * `arithmetic`: Kind wählt Rechenarten (+ − · :), die Klasse bestimmt den Zahlenbereich.
 * `topics`: Kind wählt konkrete Themen seiner (oder früherer) Klassen.
 * `review`: gemerkte, falsch gelöste Aufgaben wiederholen.
 */
export type QuizMode = 'arithmetic' | 'topics' | 'review';

export type TimerSetting =
  | { readonly mode: 'off' }
  | { readonly mode: 'perTask'; readonly seconds: number }
  | { readonly mode: 'perRound'; readonly seconds: number };

export interface QuizSettings {
  readonly grade: Grade;
  readonly mode: QuizMode;
  readonly operations: readonly Operation[];
  readonly topicIds: readonly string[];
  readonly difficulty: Difficulty;
  readonly timer: TimerSetting;
  /** Anzahl Aufgaben; bei `perRound` so viele wie in der Zeit geschafft werden. */
  readonly taskCount: number;
  /** Bundesland des Profils (`de` = allgemein) – bestimmt, welche Themen zu welcher Klasse gehören. */
  readonly state?: string;
}
