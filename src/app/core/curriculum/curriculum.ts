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

const ALL_OPS: readonly Operation[] = ['add', 'sub', 'mul', 'div'];

export const TOPICS: readonly Topic[] = [
  // Klasse 1
  { id: 'k1-add-10', grade: 1, title: 'Plus bis 10', example: '4 + 3', leitidee: 'zahl', operations: ['add'] },
  { id: 'k1-sub-10', grade: 1, title: 'Minus bis 10', example: '9 − 5', leitidee: 'zahl', operations: ['sub'] },
  { id: 'k1-add-20', grade: 1, title: 'Plus bis 20', example: '8 + 5', leitidee: 'zahl', operations: ['add'] },
  { id: 'k1-sub-20', grade: 1, title: 'Minus bis 20', example: '13 − 6', leitidee: 'zahl', operations: ['sub'] },
  { id: 'k1-missing', grade: 1, title: 'Platzhalter-Aufgaben', example: '3 + _ = 9', leitidee: 'zahl', operations: ['add', 'sub'] },
  { id: 'k1-double-half', grade: 1, title: 'Verdoppeln und Halbieren', example: 'Das Doppelte von 7', leitidee: 'zahl', operations: ['add'] },
  { id: 'k1-compare', grade: 1, title: 'Zahlen vergleichen', example: '12 ○ 15', leitidee: 'zahl' },

  // Klasse 2
  { id: 'k2-add-100', grade: 2, title: 'Plus bis 100', example: '47 + 38', leitidee: 'zahl', operations: ['add'] },
  { id: 'k2-sub-100', grade: 2, title: 'Minus bis 100', example: '82 − 45', leitidee: 'zahl', operations: ['sub'] },
  { id: 'k2-times-table', grade: 2, title: 'Kleines Einmaleins', example: '6 · 7', leitidee: 'zahl', operations: ['mul'] },
  { id: 'k2-div', grade: 2, title: 'Geteilt (ohne Rest)', example: '42 : 6', leitidee: 'zahl', operations: ['div'] },
  { id: 'k2-money', grade: 2, title: 'Rechnen mit Geld', example: '1 € − 35 ct', leitidee: 'groessen', operations: ['add', 'sub'] },
  { id: 'k2-length', grade: 2, title: 'Längen (cm, m)', example: '1 m = ? cm', leitidee: 'groessen' },
  { id: 'k2-clock', grade: 2, title: 'Uhrzeit ablesen', example: 'Wie spät ist es?', leitidee: 'groessen', figure: true },

  // Klasse 3
  { id: 'k3-add-1000', grade: 3, title: 'Plus bis 1 000', example: '456 + 278', leitidee: 'zahl', operations: ['add'] },
  { id: 'k3-sub-1000', grade: 3, title: 'Minus bis 1 000', example: '803 − 457', leitidee: 'zahl', operations: ['sub'] },
  { id: 'k3-times-tens', grade: 3, title: 'Zehnereinmaleins', example: '7 · 40', leitidee: 'zahl', operations: ['mul'] },
  { id: 'k3-div-remainder', grade: 3, title: 'Geteilt mit Rest', example: '29 : 4', leitidee: 'zahl', operations: ['div'] },
  { id: 'k3-units', grade: 3, title: 'Größen umrechnen', example: '2 kg 300 g = ? g', leitidee: 'groessen' },
  { id: 'k3-grid-area', grade: 3, title: 'Fläche und Umfang im Gitter', example: 'Kästchen zählen', leitidee: 'raum', figure: true },

  // Klasse 4
  { id: 'k4-written-add-sub', grade: 4, title: 'Schriftlich plus und minus', example: '45 312 − 17 849', leitidee: 'zahl', operations: ['add', 'sub'] },
  { id: 'k4-written-mul', grade: 4, title: 'Schriftlich malnehmen', example: '347 · 26', leitidee: 'zahl', operations: ['mul'] },
  { id: 'k4-written-div', grade: 4, title: 'Schriftlich teilen', example: '5 628 : 4', leitidee: 'zahl', operations: ['div'] },
  { id: 'k4-rounding', grade: 4, title: 'Runden und Überschlagen', example: '4 387 ≈ ?', leitidee: 'zahl' },
  { id: 'k4-units-decimal', grade: 4, title: 'Größen mit Komma', example: '3,45 m = ? cm', leitidee: 'groessen' },

  // Klasse 5
  { id: 'k5-order-of-ops', grade: 5, title: 'Punkt vor Strich, Klammern', example: '3 + 4 · (8 − 5)', leitidee: 'zahl', operations: ALL_OPS },
  { id: 'k5-laws', grade: 5, title: 'Rechengesetze geschickt nutzen', example: '7 · 98', leitidee: 'zahl', operations: ['add', 'mul'] },
  { id: 'k5-powers', grade: 5, title: 'Potenzen und Quadratzahlen', example: '2⁵', leitidee: 'zahl', operations: ['mul'] },
  { id: 'k5-divisibility', grade: 5, title: 'Teilbarkeit und Primzahlen', example: 'Welche Zahl ist durch 3 teilbar?', leitidee: 'zahl', operations: ['div'] },
  { id: 'k5-rectangle', grade: 5, title: 'Umfang und Fläche Rechteck', example: 'a = 7 cm, b = 4 cm', leitidee: 'raum' },
  { id: 'k5-fraction-of', grade: 5, title: 'Anteile berechnen', example: '¾ von 20', leitidee: 'zahl', operations: ['mul', 'div'] },
  { id: 'k5-fraction-picture', grade: 5, title: 'Brüche am Bild', example: 'Welcher Teil ist gefärbt?', leitidee: 'zahl', figure: true },
  { id: 'k5-angles', grade: 5, title: 'Winkel', example: 'spitz, recht, stumpf …', leitidee: 'raum', figure: true },

  // Klasse 6
  { id: 'k6-fraction-simplify', grade: 6, title: 'Brüche kürzen und erweitern', example: '12/18', leitidee: 'zahl' },
  { id: 'k6-fraction-add-sub', grade: 6, title: 'Brüche plus und minus', example: '1/2 + 1/3', leitidee: 'zahl', operations: ['add', 'sub'] },
  { id: 'k6-fraction-mul-div', grade: 6, title: 'Brüche mal und geteilt', example: '2/3 : 4/5', leitidee: 'zahl', operations: ['mul', 'div'] },
  { id: 'k6-gcd-lcm', grade: 6, title: 'ggT und kgV', example: 'kgV(4, 6)', leitidee: 'zahl' },
  { id: 'k6-decimal-add-sub', grade: 6, title: 'Dezimalzahlen plus und minus', example: '3,7 + 2,45', leitidee: 'zahl', operations: ['add', 'sub'] },
  { id: 'k6-decimal-mul-div', grade: 6, title: 'Dezimalzahlen mal und geteilt', example: '2,5 · 0,4', leitidee: 'zahl', operations: ['mul', 'div'] },
  { id: 'k6-convert', grade: 6, title: 'Bruch, Dezimalzahl, Prozent', example: '3/4 = ? %', leitidee: 'zahl' },
  { id: 'k6-cuboid', grade: 6, title: 'Volumen Quader', example: '3 cm · 4 cm · 5 cm', leitidee: 'raum' },

  // Klasse 7
  { id: 'k7-integers', grade: 7, title: 'Rechnen mit negativen Zahlen', example: '(−7) − (−12)', leitidee: 'zahl', operations: ALL_OPS },
  { id: 'k7-percent', grade: 7, title: 'Prozentrechnung', example: '15 % von 80', leitidee: 'zahl' },
  { id: 'k7-interest', grade: 7, title: 'Zinsrechnung', example: '500 € zu 3 %', leitidee: 'zahl' },
  { id: 'k7-rule-of-three', grade: 7, title: 'Dreisatz', example: '3 kg = 6 €, 5 kg = ?', leitidee: 'funktion' },
  { id: 'k7-terms', grade: 7, title: 'Terme zusammenfassen', example: '3x + 5 − x + 2', leitidee: 'funktion' },
  { id: 'k7-linear-equations', grade: 7, title: 'Einfache Gleichungen', example: '3x + 4 = 19', leitidee: 'funktion' },
  { id: 'k7-triangle-angles', grade: 7, title: 'Winkelsumme im Dreieck', example: 'α = 50°, β = 70°', leitidee: 'raum' },
  { id: 'k7-mean-median', grade: 7, title: 'Mittelwert und Median', example: '3, 8, 5, 1, 9', leitidee: 'daten' },

  // Klasse 8
  { id: 'k8-expand-factor', grade: 8, title: 'Ausmultiplizieren und Ausklammern', example: '3(x − 4)', leitidee: 'funktion' },
  { id: 'k8-binomial', grade: 8, title: 'Binomische Formeln', example: '(x + 5)²', leitidee: 'funktion' },
  { id: 'k8-equations-brackets', grade: 8, title: 'Gleichungen mit Klammern', example: '2(x − 3) = x + 4', leitidee: 'funktion' },
  { id: 'k8-linear-functions', grade: 8, title: 'Lineare Funktionen', example: 'Steigung durch (1|2) und (3|8)', leitidee: 'funktion' },
  { id: 'k8-graph-reading', grade: 8, title: 'Geraden am Graphen ablesen', example: 'f(x) = ? aus dem Bild', leitidee: 'funktion', figure: true },
  { id: 'k8-areas', grade: 8, title: 'Dreieck, Parallelogramm, Trapez', example: 'g = 6 cm, h = 4 cm', leitidee: 'raum' },
  { id: 'k8-laplace', grade: 8, title: 'Wahrscheinlichkeit (Laplace)', example: 'P(gerade Zahl)', leitidee: 'daten' },

  // Klasse 9
  { id: 'k9-linear-systems', grade: 9, title: 'Gleichungssysteme', example: 'x + y = 10, x − y = 2', leitidee: 'funktion' },
  { id: 'k9-roots', grade: 9, title: 'Quadratwurzeln', example: '√49 · √4', leitidee: 'zahl' },
  { id: 'k9-power-laws', grade: 9, title: 'Potenzgesetze', example: 'a³ · a⁴', leitidee: 'zahl' },
  { id: 'k9-quadratic-equations', grade: 9, title: 'Quadratische Gleichungen', example: 'x² − 5x + 6 = 0', leitidee: 'funktion' },
  { id: 'k9-parabola-vertex', grade: 9, title: 'Scheitelpunkt einer Parabel', example: 'f(x) = (x − 2)² + 3', leitidee: 'funktion' },
  { id: 'k9-pythagoras', grade: 9, title: 'Satz des Pythagoras', example: 'a = 3, b = 4, c = ?', leitidee: 'raum' },
  { id: 'k9-circle', grade: 9, title: 'Kreis: Umfang und Fläche', example: 'r = 5 cm', leitidee: 'raum' },

  // Klasse 10
  { id: 'k10-rational-exponents', grade: 10, title: 'Potenzen mit Bruch-Exponenten', example: '8^(2/3)', leitidee: 'zahl' },
  { id: 'k10-growth', grade: 10, title: 'Exponentielles Wachstum', example: '1 000 · 1,05³', leitidee: 'funktion' },
  { id: 'k10-logarithm', grade: 10, title: 'Logarithmus', example: 'log₂(32)', leitidee: 'zahl' },
  { id: 'k10-trigonometry', grade: 10, title: 'Trigonometrie', example: 'sin(30°)', leitidee: 'raum' },
  { id: 'k10-solids', grade: 10, title: 'Zylinder, Kegel, Kugel', example: 'Zylinder r = 2, h = 5', leitidee: 'raum' },
  { id: 'k10-tree-diagrams', grade: 10, title: 'Baumdiagramme', example: '2× Münze: P(2× Kopf)', leitidee: 'daten' },

  // Klasse 11
  { id: 'k11-roots-polynomials', grade: 11, title: 'Nullstellen', example: 'f(x) = x² − 9', leitidee: 'funktion' },
  { id: 'k11-derivative-rules', grade: 11, title: 'Ableitungsregeln', example: "f(x) = 3x⁴ − 2x → f'(x)", leitidee: 'funktion' },
  { id: 'k11-tangent-slope', grade: 11, title: 'Steigung an einer Stelle', example: "f(x) = x², f'(3)", leitidee: 'funktion' },
  { id: 'k11-extrema', grade: 11, title: 'Extrempunkte', example: 'f(x) = x² − 4x', leitidee: 'funktion' },
  { id: 'k11-vectors', grade: 11, title: 'Vektoren: Addition und Betrag', example: '|(3, 4)|', leitidee: 'raum' },

  // Klasse 12
  { id: 'k12-derivative-advanced', grade: 12, title: 'Produkt- und Kettenregel', example: "f(x) = (2x + 1)³ → f'(x)", leitidee: 'funktion' },
  { id: 'k12-exp-ln', grade: 12, title: 'e-Funktion und ln', example: 'ln(e³)', leitidee: 'funktion' },
  { id: 'k12-integrals', grade: 12, title: 'Integrale', example: '∫₀² 3x² dx', leitidee: 'funktion' },
  { id: 'k12-dot-product', grade: 12, title: 'Skalarprodukt', example: '(1, 2, 3) · (4, −1, 0)', leitidee: 'raum' },
  { id: 'k12-stochastics', grade: 12, title: 'Binomialverteilung und Erwartungswert', example: 'B(4; 0,5; k = 2)', leitidee: 'daten' },
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
