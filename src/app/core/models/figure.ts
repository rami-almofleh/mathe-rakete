/**
 * Bild zu einer Aufgabe – als Daten, nicht als Grafikdatei. Die Komponente `<app-figure>`
 * zeichnet daraus ein SVG. So bleiben Bild-Aufgaben zufällig erzeugt und im Test prüfbar.
 */
export type Figure = ClockFigure | GridFigure | AngleFigure | FractionFigure | GraphFigure | NumberLineFigure | BarChartFigure | SolidFigure | UrnFigure;

/** Analoge Uhr */
export interface ClockFigure {
  readonly kind: 'clock';
  /** 1–12 */
  readonly hours: number;
  /** 0–59 */
  readonly minutes: number;
}

/** Kästchengitter mit gefärbten Kästchen (Spalte, Zeile ab 0) */
export interface GridFigure {
  readonly kind: 'grid';
  readonly columns: number;
  readonly rows: number;
  readonly cells: readonly (readonly [number, number])[];
  /** Spiegelachse auf einer Gitterlinie: senkrecht bei Spalte `at` bzw. waagerecht bei Zeile `at` */
  readonly axis?: { readonly orientation: 'vertical' | 'horizontal'; readonly at: number };
}

/** Winkel zwischen zwei Schenkeln; `rotation` dreht den ersten Schenkel (Grad, gegen den Uhrzeigersinn) */
export interface AngleFigure {
  readonly kind: 'angle';
  readonly degrees: number;
  readonly rotation: number;
}

/** Kreis oder Streifen in gleich große Teile geteilt; `filled` = gefärbte Teile */
export interface FractionFigure {
  readonly kind: 'fraction';
  readonly shape: 'circle' | 'bar';
  readonly parts: number;
  readonly filled: readonly number[];
}

/** Koordinatensystem mit Geraden y = (rise/run)·x + b */
export interface GraphFigure {
  readonly kind: 'graph';
  readonly range: number;
  readonly lines: readonly { readonly rise: number; readonly run: number; readonly b: number }[];
}

/** Zahlenstrahl von `start` bis `end`; Striche alle `step`, beschriftet alle `labelEvery`; Pfeil bei `marked` */
export interface NumberLineFigure {
  readonly kind: 'numberline';
  readonly start: number;
  readonly end: number;
  readonly step: number;
  readonly labelEvery: number;
  readonly marked: number;
}

/** Säulendiagramm (Umfrage): Achse von 0 bis `max`, Hilfslinien alle `gridStep`, Zahlen alle `labelStep` */
export interface BarChartFigure {
  readonly kind: 'bars';
  readonly bars: readonly { readonly label: string; readonly value: number }[];
  readonly max: number;
  readonly gridStep: number;
  readonly labelStep: number;
}

export type SolidShape = 'cube' | 'cuboid' | 'pyramid' | 'prism' | 'cylinder' | 'cone' | 'sphere';

/** Geometrischer Körper, schräg von vorn gezeichnet (verdeckte Kanten gestrichelt) */
export interface SolidFigure {
  readonly kind: 'solid';
  readonly shape: SolidShape;
}

export type BallColor = 'rot' | 'blau' | 'gelb' | 'grün';

/** Ein oder mehrere Beutel mit farbigen Kugeln (Wahrscheinlichkeit) */
export interface UrnFigure {
  readonly kind: 'urn';
  readonly bags: readonly { readonly label?: string; readonly balls: readonly { readonly color: BallColor; readonly count: number }[] }[];
}
