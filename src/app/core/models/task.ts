import { Figure } from './figure';
import { Grade } from './grade';
import { Difficulty } from './quiz-settings';

/**
 * Anzeige-Inhalt: `plain` wird als Text in der Kinderschrift gezeigt (Grundschule),
 * `tex` wird mit KaTeX gesetzt (Brüche, Potenzen, Wurzeln, Integrale …).
 */
export type MathContent =
  | { readonly kind: 'plain'; readonly value: string }
  | { readonly kind: 'tex'; readonly value: string };

export function plain(value: string): MathContent {
  return { kind: 'plain', value };
}

export function tex(value: string): MathContent {
  return { kind: 'tex', value };
}

export interface Prompt {
  /** Arbeitsauftrag in Worten, z. B. „Kürze den Bruch“. */
  readonly instruction?: string;
  readonly math: MathContent;
  /** Bild zur Aufgabe (Uhr, Gitter, Winkel, Bruchteil, Graph). */
  readonly figure?: Figure;
}

export interface Choice {
  readonly display: MathContent;
  /** Normalisierter Wert; zwei Antworten sind gleich, wenn ihre Keys gleich sind. */
  readonly key: string;
}

/** Eine zur Laufzeit erzeugte Aufgabe mit genau einer richtigen Antwort. */
export interface Task {
  readonly id: string;
  readonly topicId: string;
  readonly grade: Grade;
  readonly difficulty: Difficulty;
  readonly prompt: Prompt;
  readonly choices: readonly [Choice, Choice, Choice];
  readonly correctIndex: 0 | 1 | 2;
  /** Kurzer Lösungsweg (eine Zeile je Schritt), wird nach einer falschen Antwort gezeigt. */
  readonly explanation?: readonly MathContent[];
}
