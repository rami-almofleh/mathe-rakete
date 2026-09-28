import { Difficulty, MathContent, Operation, Prompt } from '../models';
import { Rational } from '../math/rational';
import { Rng } from '../math/rng';
import { NumberDomain } from './domain';

export interface Answer {
  readonly display: MathContent;
  /** Normalisierter Vergleichswert, z. B. `n:3/4` für die Zahl ¾. */
  readonly key: string;
  /** Zahlenwert, falls die Antwort eine Zahl ist – für die Wertebereich-Prüfung. */
  readonly value?: Rational;
}

export interface GenerationContext {
  readonly difficulty: Difficulty;
  readonly rng: Rng;
  /** Im Modus „Rechnen“ gewählte Rechenarten; leer/undefiniert = alle des Themas. */
  readonly operations?: readonly Operation[];
}

/** Rohergebnis eines Generators; `buildChoices` macht daraus die 3 Antwortmöglichkeiten. */
export interface GeneratedTask {
  readonly prompt: Prompt;
  readonly answer: Answer;
  /**
   * Ablenker aus typischen Schülerfehlern. Duplikate, die richtige Antwort und Werte
   * außerhalb des Zahlenbereichs werden automatisch aussortiert.
   */
  readonly distractors: readonly Answer[];
  /** Erzeugt weitere Ablenker, falls die Fehlermuster nicht reichen. */
  readonly fallback?: (rng: Rng) => Answer;
  readonly explanation?: readonly MathContent[];
  /** Weicht vom Standard-Zahlenbereich der Klasse ab (z. B. Kl. 4: 345 cm = 3,45 m). */
  readonly domain?: Partial<NumberDomain>;
}

/** Ein Generator pro Thema aus dem Lehrplan-Katalog. */
export interface TaskGenerator {
  readonly topicId: string;
  generate(context: GenerationContext): GeneratedTask;
}
