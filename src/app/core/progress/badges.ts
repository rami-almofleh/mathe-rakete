import { QuizSettings } from '../models';

export interface RoundResult {
  readonly settings: QuizSettings;
  readonly total: number;
  readonly correct: number;
  readonly stars: number;
  readonly longestStreak: number;
  readonly topicIds: readonly string[];
}

export interface BadgeContext {
  readonly round: RoundResult;
  readonly totalStars: number;
  readonly roundsPlayed: number;
  readonly bestStreak: number;
  readonly correctByTopic: Readonly<Record<string, number>>;
}

export interface Badge {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly earned: (c: BadgeContext) => boolean;
}

/** Abzeichen – bewusst erreichbar, damit Kinder dranbleiben. */
export const BADGES: readonly Badge[] = [
  { id: 'first-round', title: 'Gestartet', description: 'Die erste Runde geschafft', icon: 'bi-rocket-takeoff-fill', earned: (c) => c.roundsPlayed >= 1 },
  { id: 'perfect', title: 'Fehlerfrei', description: 'Eine Runde mit mindestens 10 Aufgaben ohne Fehler', icon: 'bi-gem', earned: (c) => c.round.total >= 10 && c.round.correct === c.round.total },
  { id: 'streak-10', title: 'Serie 10', description: '10 richtige Antworten hintereinander', icon: 'bi-fire', earned: (c) => c.bestStreak >= 10 },
  { id: 'streak-25', title: 'Serie 25', description: '25 richtige Antworten hintereinander', icon: 'bi-lightning-charge-fill', earned: (c) => c.bestStreak >= 25 },
  { id: 'stars-10', title: 'Sternensammler', description: '10 Sterne gesammelt', icon: 'bi-star-fill', earned: (c) => c.totalStars >= 10 },
  { id: 'stars-50', title: 'Sternenhimmel', description: '50 Sterne gesammelt', icon: 'bi-stars', earned: (c) => c.totalStars >= 50 },
  { id: 'stars-100', title: 'Galaxie', description: '100 Sterne gesammelt', icon: 'bi-globe-americas', earned: (c) => c.totalStars >= 100 },
  { id: 'speedy', title: 'Blitzrechner', description: 'Mit Zeit pro Aufgabe mindestens 90 % richtig (ab 10 Aufgaben)', icon: 'bi-stopwatch-fill', earned: (c) => c.round.settings.timer.mode === 'perTask' && c.round.total >= 10 && c.round.correct / c.round.total >= 0.9 },
  { id: 'marathon', title: 'Ausdauer', description: 'Eine Runde mit 30 Aufgaben beendet', icon: 'bi-trophy-fill', earned: (c) => c.round.total >= 30 },
  { id: 'all-ops', title: 'Alle Rechenarten', description: 'Plus, Minus, Mal und Geteilt in einer Runde', icon: 'bi-grid-3x3-gap-fill', earned: (c) => c.round.settings.mode === 'arithmetic' && c.round.settings.operations.length === 4 && c.round.stars >= 2 },
  { id: 'times-table', title: 'Einmaleins-Profi', description: '50 richtige Einmaleins-Aufgaben', icon: 'bi-x-diamond-fill', earned: (c) => (c.correctByTopic['k2-times-table'] ?? 0) >= 50 },
  { id: 'learned', title: 'Aus Fehlern gelernt', description: 'Eine Wiederholungsrunde (ab 3 Aufgaben) ohne Fehler', icon: 'bi-arrow-repeat', earned: (c) => c.round.settings.mode === 'review' && c.round.total >= 3 && c.round.correct === c.round.total },
  { id: 'hard', title: 'Mutig', description: 'Eine schwere Runde mit mindestens 2 Sternen', icon: 'bi-shield-fill-check', earned: (c) => c.round.settings.difficulty === 'hard' && c.round.stars >= 2 },
];
