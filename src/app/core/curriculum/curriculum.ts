import { Grade, Operation } from '../models';
import { STATE_GRADE_OVERRIDES } from './states';

/**
 * Themen je Klasse nach den KMK-Bildungsstandards (siehe docs/RECHERCHE.md).
 * Dieser Katalog enthält nur Metadaten – die Aufgaben selbst erzeugen die Generatoren zur Laufzeit.
 */

export type Leitidee = 'zahl' | 'groessen' | 'raum' | 'funktion' | 'daten';

export const LEITIDEEN: Readonly<Record<Leitidee, string>> = {
  zahl: 'Zahl und Operation',
  groessen: 'Größen und Messen',
  raum: 'Raum und Form',
  funktion: 'Funktionaler Zusammenhang',
  daten: 'Daten und Zufall',
};

export interface Topic {
  readonly id: string;
  readonly grade: Grade;
  readonly title: string;
  readonly example: string;
  /** Bereich innerhalb der Klasse (siehe `CHAPTERS`) – gliedert die Lektionsliste wie bei ANTON. */
  readonly chapter: string;
  /** Bootstrap-Icon für die Lektionsliste */
  readonly icon: string;
  readonly leitidee: Leitidee;
  /** Rechenarten, die das Thema abdeckt; steuert den Filter im Modus „Rechnen“. */
  readonly operations?: readonly Operation[];
  /** Aufgabe mit Bild (Uhr, Gitter, Winkel …) */
  readonly figure?: boolean;
}

export interface GradeInfo {
  readonly grade: Grade;
  /** Kurzer Untertitel für die Startseite. */
  readonly tagline: string;
}

export const GRADE_INFO: Readonly<Record<Grade, GradeInfo>> = {
  1: { grade: 1, tagline: 'Zahlen bis 20' },
  2: { grade: 2, tagline: 'Zahlen bis 100 · Einmaleins' },
  3: { grade: 3, tagline: 'Zahlen bis 1 000' },
  4: { grade: 4, tagline: 'Schriftlich rechnen' },
  5: { grade: 5, tagline: 'Rechengesetze · Potenzen' },
  6: { grade: 6, tagline: 'Brüche · Dezimalzahlen' },
  7: { grade: 7, tagline: 'Negative Zahlen · Prozent' },
  8: { grade: 8, tagline: 'Terme · Lineare Funktionen' },
  9: { grade: 9, tagline: 'Wurzeln · Pythagoras' },
  10: { grade: 10, tagline: 'Logarithmus · Trigonometrie' },
  11: { grade: 11, tagline: 'Ableitungen' },
  12: { grade: 12, tagline: 'Integrale · Stochastik' },
};

/** Kindgerechter Bereich einer Klasse, z. B. „Größen“ – enthält mehrere Lektionen (= Themen). */
export interface Chapter {
  readonly id: string;
  readonly grade: Grade;
  readonly title: string;
  readonly icon: string;
  readonly leitidee: Leitidee;
}

/** Reihenfolge = Reihenfolge in der Lektionsliste. */
export const CHAPTERS: readonly Chapter[] = [
  { id: 'k1-zahlen', grade: 1, title: 'Zahlen bis 20', icon: 'bi-123', leitidee: 'zahl' },
  { id: 'k1-rechnen-10', grade: 1, title: 'Rechnen bis 10', icon: 'bi-plus-slash-minus', leitidee: 'zahl' },
  { id: 'k1-rechnen-20', grade: 1, title: 'Rechnen bis 20', icon: 'bi-plus-slash-minus', leitidee: 'zahl' },

  { id: 'k2-rechnen', grade: 2, title: 'Plus und Minus bis 100', icon: 'bi-plus-slash-minus', leitidee: 'zahl' },
  { id: 'k2-einmaleins', grade: 2, title: 'Einmaleins', icon: 'bi-x-lg', leitidee: 'zahl' },
  { id: 'k2-groessen', grade: 2, title: 'Größen', icon: 'bi-rulers', leitidee: 'groessen' },

  { id: 'k3-rechnen', grade: 3, title: 'Plus und Minus bis 1 000', icon: 'bi-plus-slash-minus', leitidee: 'zahl' },
  { id: 'k3-mal-geteilt', grade: 3, title: 'Mal und geteilt', icon: 'bi-x-lg', leitidee: 'zahl' },
  { id: 'k3-groessen', grade: 3, title: 'Größen', icon: 'bi-rulers', leitidee: 'groessen' },
  { id: 'k3-geometrie', grade: 3, title: 'Geometrie', icon: 'bi-triangle', leitidee: 'raum' },

  { id: 'k4-zahlen', grade: 4, title: 'Große Zahlen', icon: 'bi-123', leitidee: 'zahl' },
  { id: 'k4-schriftlich', grade: 4, title: 'Schriftlich rechnen', icon: 'bi-pencil', leitidee: 'zahl' },
  { id: 'k4-groessen', grade: 4, title: 'Größen', icon: 'bi-rulers', leitidee: 'groessen' },

  { id: 'k5-rechnen', grade: 5, title: 'Rechnen und Rechengesetze', icon: 'bi-calculator', leitidee: 'zahl' },
  { id: 'k5-teilbarkeit', grade: 5, title: 'Teilbarkeit', icon: 'bi-funnel', leitidee: 'zahl' },
  { id: 'k5-brueche', grade: 5, title: 'Brüche', icon: 'bi-pie-chart', leitidee: 'zahl' },
  { id: 'k5-geometrie', grade: 5, title: 'Geometrie', icon: 'bi-triangle', leitidee: 'raum' },

  { id: 'k6-brueche', grade: 6, title: 'Brüche', icon: 'bi-pie-chart', leitidee: 'zahl' },
  { id: 'k6-dezimal', grade: 6, title: 'Dezimalzahlen und Prozent', icon: 'bi-percent', leitidee: 'zahl' },
  { id: 'k6-geometrie', grade: 6, title: 'Geometrie', icon: 'bi-box', leitidee: 'raum' },

  { id: 'k7-zahlen', grade: 7, title: 'Negative Zahlen', icon: 'bi-thermometer-half', leitidee: 'zahl' },
  { id: 'k7-prozent', grade: 7, title: 'Prozent und Zinsen', icon: 'bi-percent', leitidee: 'zahl' },
  { id: 'k7-zuordnungen', grade: 7, title: 'Zuordnungen', icon: 'bi-cart', leitidee: 'funktion' },
  { id: 'k7-terme', grade: 7, title: 'Terme und Gleichungen', icon: 'bi-braces', leitidee: 'funktion' },
  { id: 'k7-geometrie', grade: 7, title: 'Geometrie', icon: 'bi-triangle', leitidee: 'raum' },
  { id: 'k7-daten', grade: 7, title: 'Daten', icon: 'bi-bar-chart', leitidee: 'daten' },

  { id: 'k8-terme', grade: 8, title: 'Terme und Gleichungen', icon: 'bi-braces', leitidee: 'funktion' },
  { id: 'k8-funktionen', grade: 8, title: 'Lineare Funktionen', icon: 'bi-graph-up', leitidee: 'funktion' },
  { id: 'k8-geometrie', grade: 8, title: 'Geometrie', icon: 'bi-triangle', leitidee: 'raum' },
  { id: 'k8-daten', grade: 8, title: 'Wahrscheinlichkeit', icon: 'bi-dice-5', leitidee: 'daten' },

  { id: 'k9-zahlen', grade: 9, title: 'Wurzeln und Potenzen', icon: 'bi-superscript', leitidee: 'zahl' },
  { id: 'k9-gleichungen', grade: 9, title: 'Gleichungen', icon: 'bi-sliders', leitidee: 'funktion' },
  { id: 'k9-funktionen', grade: 9, title: 'Parabeln', icon: 'bi-graph-up', leitidee: 'funktion' },
  { id: 'k9-geometrie', grade: 9, title: 'Geometrie', icon: 'bi-triangle', leitidee: 'raum' },

  { id: 'k10-zahlen', grade: 10, title: 'Potenzen und Logarithmen', icon: 'bi-superscript', leitidee: 'zahl' },
  { id: 'k10-funktionen', grade: 10, title: 'Wachstum', icon: 'bi-graph-up-arrow', leitidee: 'funktion' },
  { id: 'k10-geometrie', grade: 10, title: 'Geometrie', icon: 'bi-triangle', leitidee: 'raum' },
  { id: 'k10-daten', grade: 10, title: 'Wahrscheinlichkeit', icon: 'bi-dice-5', leitidee: 'daten' },

  { id: 'k11-analysis', grade: 11, title: 'Analysis', icon: 'bi-graph-up', leitidee: 'funktion' },
  { id: 'k11-vektoren', grade: 11, title: 'Vektoren', icon: 'bi-arrow-up-right', leitidee: 'raum' },

  { id: 'k12-analysis', grade: 12, title: 'Analysis', icon: 'bi-graph-up', leitidee: 'funktion' },
  { id: 'k12-vektoren', grade: 12, title: 'Vektoren', icon: 'bi-arrow-up-right', leitidee: 'raum' },
  { id: 'k12-stochastik', grade: 12, title: 'Stochastik', icon: 'bi-dice-5', leitidee: 'daten' },
];

/** Bereich für Themen, die in einer Klasse ohne passenden Bereich landen (Bundesland-Abweichung). */
export const OTHER_CHAPTER_ID = 'weitere';

const ALL_OPS: readonly Operation[] = ['add', 'sub', 'mul', 'div'];

export const TOPICS: readonly Topic[] = [
  // Klasse 1
  { id: 'k1-add-10', grade: 1, title: 'Plus bis 10', example: '4 + 3', chapter: 'k1-rechnen-10', icon: 'bi-plus-lg', leitidee: 'zahl', operations: ['add'] },
  { id: 'k1-sub-10', grade: 1, title: 'Minus bis 10', example: '9 − 5', chapter: 'k1-rechnen-10', icon: 'bi-dash-lg', leitidee: 'zahl', operations: ['sub'] },
  { id: 'k1-add-20', grade: 1, title: 'Plus bis 20', example: '8 + 5', chapter: 'k1-rechnen-20', icon: 'bi-plus-circle', leitidee: 'zahl', operations: ['add'] },
  { id: 'k1-sub-20', grade: 1, title: 'Minus bis 20', example: '13 − 6', chapter: 'k1-rechnen-20', icon: 'bi-dash-circle', leitidee: 'zahl', operations: ['sub'] },
  { id: 'k1-missing', grade: 1, title: 'Platzhalter-Aufgaben', example: '3 + _ = 9', chapter: 'k1-rechnen-20', icon: 'bi-question-square', leitidee: 'zahl', operations: ['add', 'sub'] },
  { id: 'k1-double-half', grade: 1, title: 'Verdoppeln und Halbieren', example: 'Das Doppelte von 7', chapter: 'k1-zahlen', icon: 'bi-layout-split', leitidee: 'zahl', operations: ['add'] },
  { id: 'k1-compare', grade: 1, title: 'Zahlen vergleichen', example: '12 ○ 15', chapter: 'k1-zahlen', icon: 'bi-arrow-left-right', leitidee: 'zahl' },

  // Klasse 2
  { id: 'k2-add-100', grade: 2, title: 'Plus bis 100', example: '47 + 38', chapter: 'k2-rechnen', icon: 'bi-plus-lg', leitidee: 'zahl', operations: ['add'] },
  { id: 'k2-sub-100', grade: 2, title: 'Minus bis 100', example: '82 − 45', chapter: 'k2-rechnen', icon: 'bi-dash-lg', leitidee: 'zahl', operations: ['sub'] },
  { id: 'k2-times-table', grade: 2, title: 'Kleines Einmaleins', example: '6 · 7', chapter: 'k2-einmaleins', icon: 'bi-x-lg', leitidee: 'zahl', operations: ['mul'] },
  { id: 'k2-div', grade: 2, title: 'Geteilt (ohne Rest)', example: '42 : 6', chapter: 'k2-einmaleins', icon: 'bi-slash-lg', leitidee: 'zahl', operations: ['div'] },
  { id: 'k2-money', grade: 2, title: 'Rechnen mit Geld', example: '1 € − 35 ct', chapter: 'k2-groessen', icon: 'bi-coin', leitidee: 'groessen', operations: ['add', 'sub'] },
  { id: 'k2-length', grade: 2, title: 'Längen (cm, m)', example: '1 m = ? cm', chapter: 'k2-groessen', icon: 'bi-rulers', leitidee: 'groessen' },
  { id: 'k2-clock', grade: 2, title: 'Uhrzeit ablesen', example: 'Wie spät ist es?', chapter: 'k2-groessen', icon: 'bi-clock', leitidee: 'groessen', figure: true },

  // Klasse 3
  { id: 'k3-add-1000', grade: 3, title: 'Plus bis 1 000', example: '456 + 278', chapter: 'k3-rechnen', icon: 'bi-plus-lg', leitidee: 'zahl', operations: ['add'] },
  { id: 'k3-sub-1000', grade: 3, title: 'Minus bis 1 000', example: '803 − 457', chapter: 'k3-rechnen', icon: 'bi-dash-lg', leitidee: 'zahl', operations: ['sub'] },
  { id: 'k3-times-tens', grade: 3, title: 'Zehnereinmaleins', example: '7 · 40', chapter: 'k3-mal-geteilt', icon: 'bi-x-lg', leitidee: 'zahl', operations: ['mul'] },
  { id: 'k3-div-remainder', grade: 3, title: 'Geteilt mit Rest', example: '29 : 4', chapter: 'k3-mal-geteilt', icon: 'bi-slash-lg', leitidee: 'zahl', operations: ['div'] },
  { id: 'k3-units', grade: 3, title: 'Größen umrechnen', example: '2 kg 300 g = ? g', chapter: 'k3-groessen', icon: 'bi-basket', leitidee: 'groessen' },
  { id: 'k3-grid-area', grade: 3, title: 'Fläche und Umfang im Gitter', example: 'Kästchen zählen', chapter: 'k3-geometrie', icon: 'bi-grid-3x3', leitidee: 'raum', figure: true },

  // Klasse 4
  { id: 'k4-written-add-sub', grade: 4, title: 'Schriftlich plus und minus', example: '45 312 − 17 849', chapter: 'k4-schriftlich', icon: 'bi-pencil', leitidee: 'zahl', operations: ['add', 'sub'] },
  { id: 'k4-written-mul', grade: 4, title: 'Schriftlich malnehmen', example: '347 · 26', chapter: 'k4-schriftlich', icon: 'bi-x-lg', leitidee: 'zahl', operations: ['mul'] },
  { id: 'k4-written-div', grade: 4, title: 'Schriftlich teilen', example: '5 628 : 4', chapter: 'k4-schriftlich', icon: 'bi-slash-lg', leitidee: 'zahl', operations: ['div'] },
  { id: 'k4-rounding', grade: 4, title: 'Runden und Überschlagen', example: '4 387 ≈ ?', chapter: 'k4-zahlen', icon: 'bi-bullseye', leitidee: 'zahl' },
  { id: 'k4-units-decimal', grade: 4, title: 'Größen mit Komma', example: '3,45 m = ? cm', chapter: 'k4-groessen', icon: 'bi-rulers', leitidee: 'groessen' },

  // Klasse 5
  { id: 'k5-order-of-ops', grade: 5, title: 'Punkt vor Strich, Klammern', example: '3 + 4 · (8 − 5)', chapter: 'k5-rechnen', icon: 'bi-list-ol', leitidee: 'zahl', operations: ALL_OPS },
  { id: 'k5-laws', grade: 5, title: 'Rechengesetze geschickt nutzen', example: '7 · 98', chapter: 'k5-rechnen', icon: 'bi-lightning-charge', leitidee: 'zahl', operations: ['add', 'mul'] },
  { id: 'k5-powers', grade: 5, title: 'Potenzen und Quadratzahlen', example: '2⁵', chapter: 'k5-rechnen', icon: 'bi-superscript', leitidee: 'zahl', operations: ['mul'] },
  { id: 'k5-divisibility', grade: 5, title: 'Teilbarkeit und Primzahlen', example: 'Welche Zahl ist durch 3 teilbar?', chapter: 'k5-teilbarkeit', icon: 'bi-funnel', leitidee: 'zahl', operations: ['div'] },
  { id: 'k5-rectangle', grade: 5, title: 'Umfang und Fläche Rechteck', example: 'a = 7 cm, b = 4 cm', chapter: 'k5-geometrie', icon: 'bi-bounding-box', leitidee: 'raum' },
  { id: 'k5-fraction-of', grade: 5, title: 'Anteile berechnen', example: '¾ von 20', chapter: 'k5-brueche', icon: 'bi-pie-chart', leitidee: 'zahl', operations: ['mul', 'div'] },
  { id: 'k5-fraction-picture', grade: 5, title: 'Brüche am Bild', example: 'Welcher Teil ist gefärbt?', chapter: 'k5-brueche', icon: 'bi-pie-chart-fill', leitidee: 'zahl', figure: true },
  { id: 'k5-angles', grade: 5, title: 'Winkel', example: 'spitz, recht, stumpf …', chapter: 'k5-geometrie', icon: 'bi-rulers', leitidee: 'raum', figure: true },

  // Klasse 6
  { id: 'k6-fraction-simplify', grade: 6, title: 'Brüche kürzen und erweitern', example: '12/18', chapter: 'k6-brueche', icon: 'bi-arrows-collapse', leitidee: 'zahl' },
  { id: 'k6-fraction-add-sub', grade: 6, title: 'Brüche plus und minus', example: '1/2 + 1/3', chapter: 'k6-brueche', icon: 'bi-plus-slash-minus', leitidee: 'zahl', operations: ['add', 'sub'] },
  { id: 'k6-fraction-mul-div', grade: 6, title: 'Brüche mal und geteilt', example: '2/3 : 4/5', chapter: 'k6-brueche', icon: 'bi-x-lg', leitidee: 'zahl', operations: ['mul', 'div'] },
  { id: 'k6-gcd-lcm', grade: 6, title: 'ggT und kgV', example: 'kgV(4, 6)', chapter: 'k6-brueche', icon: 'bi-diagram-3', leitidee: 'zahl' },
  { id: 'k6-decimal-add-sub', grade: 6, title: 'Dezimalzahlen plus und minus', example: '3,7 + 2,45', chapter: 'k6-dezimal', icon: 'bi-plus-slash-minus', leitidee: 'zahl', operations: ['add', 'sub'] },
  { id: 'k6-decimal-mul-div', grade: 6, title: 'Dezimalzahlen mal und geteilt', example: '2,5 · 0,4', chapter: 'k6-dezimal', icon: 'bi-x-lg', leitidee: 'zahl', operations: ['mul', 'div'] },
  { id: 'k6-convert', grade: 6, title: 'Bruch, Dezimalzahl, Prozent', example: '3/4 = ? %', chapter: 'k6-dezimal', icon: 'bi-percent', leitidee: 'zahl' },
  { id: 'k6-cuboid', grade: 6, title: 'Volumen Quader', example: '3 cm · 4 cm · 5 cm', chapter: 'k6-geometrie', icon: 'bi-box', leitidee: 'raum' },

  // Klasse 7
  { id: 'k7-integers', grade: 7, title: 'Rechnen mit negativen Zahlen', example: '(−7) − (−12)', chapter: 'k7-zahlen', icon: 'bi-thermometer-half', leitidee: 'zahl', operations: ALL_OPS },
  { id: 'k7-percent', grade: 7, title: 'Prozentrechnung', example: '15 % von 80', chapter: 'k7-prozent', icon: 'bi-percent', leitidee: 'zahl' },
  { id: 'k7-interest', grade: 7, title: 'Zinsrechnung', example: '500 € zu 3 %', chapter: 'k7-prozent', icon: 'bi-piggy-bank', leitidee: 'zahl' },
  { id: 'k7-rule-of-three', grade: 7, title: 'Dreisatz', example: '3 kg = 6 €, 5 kg = ?', chapter: 'k7-zuordnungen', icon: 'bi-cart', leitidee: 'funktion' },
  { id: 'k7-terms', grade: 7, title: 'Terme zusammenfassen', example: '3x + 5 − x + 2', chapter: 'k7-terme', icon: 'bi-braces', leitidee: 'funktion' },
  { id: 'k7-linear-equations', grade: 7, title: 'Einfache Gleichungen', example: '3x + 4 = 19', chapter: 'k7-terme', icon: 'bi-sliders', leitidee: 'funktion' },
  { id: 'k7-triangle-angles', grade: 7, title: 'Winkelsumme im Dreieck', example: 'α = 50°, β = 70°', chapter: 'k7-geometrie', icon: 'bi-triangle', leitidee: 'raum' },
  { id: 'k7-mean-median', grade: 7, title: 'Mittelwert und Median', example: '3, 8, 5, 1, 9', chapter: 'k7-daten', icon: 'bi-bar-chart', leitidee: 'daten' },

  // Klasse 8
  { id: 'k8-expand-factor', grade: 8, title: 'Ausmultiplizieren und Ausklammern', example: '3(x − 4)', chapter: 'k8-terme', icon: 'bi-braces', leitidee: 'funktion' },
  { id: 'k8-binomial', grade: 8, title: 'Binomische Formeln', example: '(x + 5)²', chapter: 'k8-terme', icon: 'bi-square', leitidee: 'funktion' },
  { id: 'k8-equations-brackets', grade: 8, title: 'Gleichungen mit Klammern', example: '2(x − 3) = x + 4', chapter: 'k8-terme', icon: 'bi-sliders', leitidee: 'funktion' },
  { id: 'k8-linear-functions', grade: 8, title: 'Lineare Funktionen', example: 'Steigung durch (1|2) und (3|8)', chapter: 'k8-funktionen', icon: 'bi-graph-up', leitidee: 'funktion' },
  { id: 'k8-graph-reading', grade: 8, title: 'Geraden am Graphen ablesen', example: 'f(x) = ? aus dem Bild', chapter: 'k8-funktionen', icon: 'bi-graph-up-arrow', leitidee: 'funktion', figure: true },
  { id: 'k8-areas', grade: 8, title: 'Dreieck, Parallelogramm, Trapez', example: 'g = 6 cm, h = 4 cm', chapter: 'k8-geometrie', icon: 'bi-triangle', leitidee: 'raum' },
  { id: 'k8-laplace', grade: 8, title: 'Wahrscheinlichkeit (Laplace)', example: 'P(gerade Zahl)', chapter: 'k8-daten', icon: 'bi-dice-5', leitidee: 'daten' },

  // Klasse 9
  { id: 'k9-linear-systems', grade: 9, title: 'Gleichungssysteme', example: 'x + y = 10, x − y = 2', chapter: 'k9-gleichungen', icon: 'bi-intersect', leitidee: 'funktion' },
  { id: 'k9-roots', grade: 9, title: 'Quadratwurzeln', example: '√49 · √4', chapter: 'k9-zahlen', icon: 'bi-check2-square', leitidee: 'zahl' },
  { id: 'k9-power-laws', grade: 9, title: 'Potenzgesetze', example: 'a³ · a⁴', chapter: 'k9-zahlen', icon: 'bi-superscript', leitidee: 'zahl' },
  { id: 'k9-quadratic-equations', grade: 9, title: 'Quadratische Gleichungen', example: 'x² − 5x + 6 = 0', chapter: 'k9-gleichungen', icon: 'bi-sliders', leitidee: 'funktion' },
  { id: 'k9-parabola-vertex', grade: 9, title: 'Scheitelpunkt einer Parabel', example: 'f(x) = (x − 2)² + 3', chapter: 'k9-funktionen', icon: 'bi-cup', leitidee: 'funktion' },
  { id: 'k9-pythagoras', grade: 9, title: 'Satz des Pythagoras', example: 'a = 3, b = 4, c = ?', chapter: 'k9-geometrie', icon: 'bi-triangle', leitidee: 'raum' },
  { id: 'k9-circle', grade: 9, title: 'Kreis: Umfang und Fläche', example: 'r = 5 cm', chapter: 'k9-geometrie', icon: 'bi-circle', leitidee: 'raum' },

  // Klasse 10
  { id: 'k10-rational-exponents', grade: 10, title: 'Potenzen mit Bruch-Exponenten', example: '8^(2/3)', chapter: 'k10-zahlen', icon: 'bi-superscript', leitidee: 'zahl' },
  { id: 'k10-growth', grade: 10, title: 'Exponentielles Wachstum', example: '1 000 · 1,05³', chapter: 'k10-funktionen', icon: 'bi-graph-up-arrow', leitidee: 'funktion' },
  { id: 'k10-logarithm', grade: 10, title: 'Logarithmus', example: 'log₂(32)', chapter: 'k10-zahlen', icon: 'bi-calculator', leitidee: 'zahl' },
  { id: 'k10-trigonometry', grade: 10, title: 'Trigonometrie', example: 'sin(30°)', chapter: 'k10-geometrie', icon: 'bi-triangle', leitidee: 'raum' },
  { id: 'k10-solids', grade: 10, title: 'Zylinder, Kegel, Kugel', example: 'Zylinder r = 2, h = 5', chapter: 'k10-geometrie', icon: 'bi-box', leitidee: 'raum' },
  { id: 'k10-tree-diagrams', grade: 10, title: 'Baumdiagramme', example: '2× Münze: P(2× Kopf)', chapter: 'k10-daten', icon: 'bi-diagram-3', leitidee: 'daten' },

  // Klasse 11
  { id: 'k11-roots-polynomials', grade: 11, title: 'Nullstellen', example: 'f(x) = x² − 9', chapter: 'k11-analysis', icon: 'bi-bullseye', leitidee: 'funktion' },
  { id: 'k11-derivative-rules', grade: 11, title: 'Ableitungsregeln', example: "f(x) = 3x⁴ − 2x → f'(x)", chapter: 'k11-analysis', icon: 'bi-graph-up', leitidee: 'funktion' },
  { id: 'k11-tangent-slope', grade: 11, title: 'Steigung an einer Stelle', example: "f(x) = x², f'(3)", chapter: 'k11-analysis', icon: 'bi-graph-up-arrow', leitidee: 'funktion' },
  { id: 'k11-extrema', grade: 11, title: 'Extrempunkte', example: 'f(x) = x² − 4x', chapter: 'k11-analysis', icon: 'bi-arrow-down-up', leitidee: 'funktion' },
  { id: 'k11-vectors', grade: 11, title: 'Vektoren: Addition und Betrag', example: '|(3, 4)|', chapter: 'k11-vektoren', icon: 'bi-arrow-up-right', leitidee: 'raum' },

  // Klasse 12
  { id: 'k12-derivative-advanced', grade: 12, title: 'Produkt- und Kettenregel', example: "f(x) = (2x + 1)³ → f'(x)", chapter: 'k12-analysis', icon: 'bi-link-45deg', leitidee: 'funktion' },
  { id: 'k12-exp-ln', grade: 12, title: 'e-Funktion und ln', example: 'ln(e³)', chapter: 'k12-analysis', icon: 'bi-graph-up-arrow', leitidee: 'funktion' },
  { id: 'k12-integrals', grade: 12, title: 'Integrale', example: '∫₀² 3x² dx', chapter: 'k12-analysis', icon: 'bi-bar-chart-steps', leitidee: 'funktion' },
  { id: 'k12-dot-product', grade: 12, title: 'Skalarprodukt', example: '(1, 2, 3) · (4, −1, 0)', chapter: 'k12-vektoren', icon: 'bi-arrow-up-right', leitidee: 'raum' },
  { id: 'k12-stochastics', grade: 12, title: 'Binomialverteilung und Erwartungswert', example: 'B(4; 0,5; k = 2)', chapter: 'k12-stochastik', icon: 'bi-dice-5', leitidee: 'daten' },
];

/** Klasse, in der ein Thema im gewählten Bundesland unterrichtet wird. */
export function gradeOf(topic: Topic, state = 'de'): Grade {
  return STATE_GRADE_OVERRIDES[state]?.[topic.id] ?? topic.grade;
}

export function topicsForGrade(grade: Grade, state = 'de'): readonly Topic[] {
  return TOPICS.filter((t) => gradeOf(t, state) === grade);
}

/** Themen der Klasse und aller früheren Klassen – für Wiederholungen. */
export function topicsUpToGrade(grade: Grade, state = 'de'): readonly Topic[] {
  return TOPICS.filter((t) => gradeOf(t, state) <= grade);
}

export function findTopic(id: string): Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}

export interface ChapterGroup {
  readonly chapter: Chapter;
  readonly topics: readonly Topic[];
}

/**
 * Lektionsliste einer Klasse, gegliedert nach Bereichen. Wandert ein Thema im Bundesland in eine
 * andere Klasse, kommt es dort in den Bereich mit gleichem Titel, sonst gleicher Leitidee, sonst
 * unter „Weitere Themen“. Leere Bereiche fallen weg.
 */
export function chaptersForGrade(grade: Grade, state = 'de'): readonly ChapterGroup[] {
  const chapters = CHAPTERS.filter((c) => c.grade === grade);
  const other: Chapter = { id: OTHER_CHAPTER_ID, grade, title: 'Weitere Themen', icon: 'bi-stars', leitidee: 'zahl' };
  const byChapter = new Map<string, Topic[]>();
  for (const topic of topicsForGrade(grade, state)) {
    const chapterId = chapterIdIn(topic, chapters);
    byChapter.set(chapterId, [...(byChapter.get(chapterId) ?? []), topic]);
  }
  return [...chapters, other]
    .map((chapter) => ({ chapter, topics: byChapter.get(chapter.id) ?? [] }))
    .filter((g) => g.topics.length > 0);
}

function chapterIdIn(topic: Topic, chapters: readonly Chapter[]): string {
  if (chapters.some((c) => c.id === topic.chapter)) return topic.chapter;
  const ownTitle = findChapter(topic.chapter)?.title;
  return (
    chapters.find((c) => c.title === ownTitle)?.id ??
    chapters.find((c) => c.leitidee === topic.leitidee)?.id ??
    OTHER_CHAPTER_ID
  );
}

export function findChapter(id: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.id === id);
}
