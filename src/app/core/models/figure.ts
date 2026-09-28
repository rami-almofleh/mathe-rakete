/**
 * Bild zu einer Aufgabe – als Daten, nicht als Grafikdatei. Die Komponente `<app-figure>`
 * zeichnet daraus ein SVG. So bleiben Bild-Aufgaben zufällig erzeugt und im Test prüfbar.
 */
export type Figure = ClockFigure | GridFigure | AngleFigure | FractionFigure | GraphFigure;

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
