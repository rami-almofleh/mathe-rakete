import { Component, computed, input } from '@angular/core';
import { AngleFigure, ClockFigure, Figure, FractionFigure, GraphFigure, GridFigure } from '../../core/models';

const RAD = Math.PI / 180;

/** Punkt auf einem Kreis; 0° = oben, im Uhrzeigersinn (wie bei der Uhr) */
function clockPoint(cx: number, cy: number, r: number, deg: number): [number, number] {
  return [cx + r * Math.sin(deg * RAD), cy - r * Math.cos(deg * RAD)];
}

/** Punkt für mathematische Winkel; 0° = rechts, gegen den Uhrzeigersinn */
function mathPoint(cx: number, cy: number, r: number, deg: number): [number, number] {
  return [cx + r * Math.cos(deg * RAD), cy - r * Math.sin(deg * RAD)];
}

const f = (n: number) => n.toFixed(2);

/** Beschreibung für Screenreader – verrät die Lösung nicht, wo das Bild die Aufgabe ist. */
export function figureLabel(figure: Figure): string {
  switch (figure.kind) {
    case 'clock':
      return 'Analoge Uhr mit Stunden- und Minutenzeiger';
    case 'grid':
      return 'Kästchengitter mit einer gefärbten Figur';
    case 'angle':
      return 'Winkel zwischen zwei Schenkeln';
    case 'fraction':
      return `${figure.shape === 'circle' ? 'Kreis' : 'Streifen'} in ${figure.parts} gleiche Teile geteilt, ${figure.filled.length} davon gefärbt`;
    case 'graph':
      return 'Koordinatensystem mit einer Geraden';
  }
}

@Component({
  selector: 'app-figure',
  templateUrl: './figure-view.html',
  styleUrl: './figure-view.scss',
})
export class FigureView {
  readonly figure = input.required<Figure>();
  /** Kleinere Darstellung (z. B. in der Fehlerliste) */
  readonly compact = input(false);

  protected readonly label = computed(() => figureLabel(this.figure()));

  // ---- Uhr -------------------------------------------------------------------------------
  protected readonly clock = computed(() => {
    const fig = this.figure();
    if (fig.kind !== 'clock') return null;
    const c: ClockFigure = fig;
    const hourAngle = ((c.hours % 12) + c.minutes / 60) * 30;
    const minuteAngle = c.minutes * 6;
    const [hx, hy] = clockPoint(100, 100, 48, hourAngle);
    const [mx, my] = clockPoint(100, 100, 74, minuteAngle);
    return {
      hour: { x: f(hx), y: f(hy) },
      minute: { x: f(mx), y: f(my) },
      numbers: Array.from({ length: 12 }, (_, i) => {
        const [x, y] = clockPoint(100, 100, 70, (i + 1) * 30);
        return { n: i + 1, x: f(x), y: f(y + 6) };
      }),
      ticks: Array.from({ length: 60 }, (_, i) => {
        const long = i % 5 === 0;
        const [x1, y1] = clockPoint(100, 100, long ? 82 : 86, i * 6);
        const [x2, y2] = clockPoint(100, 100, 90, i * 6);
        return { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), long };
      }),
    };
  });

  // ---- Kästchengitter ---------------------------------------------------------------------
  protected readonly grid = computed(() => {
    const fig = this.figure();
    if (fig.kind !== 'grid') return null;
    const g: GridFigure = fig;
    const size = 24;
    return {
      width: g.columns * size + 2,
      height: g.rows * size + 2,
      size,
      cells: g.cells.map(([c, r]) => ({ x: c * size + 1, y: r * size + 1 })),
      vertical: Array.from({ length: g.columns + 1 }, (_, i) => i * size + 1),
      horizontal: Array.from({ length: g.rows + 1 }, (_, i) => i * size + 1),
    };
  });

  // ---- Winkel ------------------------------------------------------------------------------
  protected readonly angle = computed(() => {
    const fig = this.figure();
    if (fig.kind !== 'angle') return null;
    const a: AngleFigure = fig;
    const [cx, cy] = [120, 95];
    const [x1, y1] = mathPoint(cx, cy, 85, a.rotation);
    const [x2, y2] = mathPoint(cx, cy, 85, a.rotation + a.degrees);
    const arcR = a.degrees === 90 ? 0 : 28;
    const [ax1, ay1] = mathPoint(cx, cy, arcR, a.rotation);
    const [ax2, ay2] = mathPoint(cx, cy, arcR, a.rotation + a.degrees);
    const large = a.degrees > 180 ? 1 : 0;
    // rechter Winkel: Quadrat statt Bogen
    const [s1x, s1y] = mathPoint(cx, cy, 20, a.rotation);
    const [s2x, s2y] = mathPoint(cx, cy, 20, a.rotation + 90);
    const [s3x, s3y] = [s1x + s2x - cx, s1y + s2y - cy];
    return {
      cx,
      cy,
      ray1: { x: f(x1), y: f(y1) },
      ray2: { x: f(x2), y: f(y2) },
      arc: a.degrees === 90 ? null : `M ${f(ax1)} ${f(ay1)} A ${arcR} ${arcR} 0 ${large} 0 ${f(ax2)} ${f(ay2)}`,
      square: a.degrees === 90 ? `M ${f(s1x)} ${f(s1y)} L ${f(s3x)} ${f(s3y)} L ${f(s2x)} ${f(s2y)}` : null,
    };
  });

  // ---- Bruchteile ----------------------------------------------------------------------------
  protected readonly fraction = computed(() => {
    const fig = this.figure();
    if (fig.kind !== 'fraction') return null;
    const fr: FractionFigure = fig;
    const filled = new Set(fr.filled);
    if (fr.shape === 'bar') {
      const w = 220 / fr.parts;
      return {
        bar: Array.from({ length: fr.parts }, (_, i) => ({ x: f(10 + i * w), w: f(w), filled: filled.has(i) })),
        circle: null,
      };
    }
    return {
      bar: null,
      circle: Array.from({ length: fr.parts }, (_, i) => {
        const start = (i * 360) / fr.parts;
        const end = ((i + 1) * 360) / fr.parts;
        const [x1, y1] = clockPoint(100, 100, 85, start);
        const [x2, y2] = clockPoint(100, 100, 85, end);
        const large = end - start > 180 ? 1 : 0;
        return { path: `M 100 100 L ${f(x1)} ${f(y1)} A 85 85 0 ${large} 1 ${f(x2)} ${f(y2)} Z`, filled: filled.has(i) };
      }),
    };
  });

  // ---- Funktionsgraph --------------------------------------------------------------------------
  protected readonly graph = computed(() => {
    const fig = this.figure();
    if (fig.kind !== 'graph') return null;
    const g: GraphFigure = fig;
    const unit = 20;
    const size = g.range * 2 * unit;
    const px = (x: number) => (x + g.range) * unit + 10;
    const py = (y: number) => (g.range - y) * unit + 10;
    const ticks = Array.from({ length: 2 * g.range + 1 }, (_, i) => i - g.range);
    return {
      size: size + 20,
      origin: { x: px(0), y: py(0) },
      min: 10,
      max: size + 10,
      ticks: ticks.map((t) => ({ t, x: px(t), y: py(t) })),
      lines: g.lines.map((l) => {
        const m = l.rise / l.run;
        // Gerade am Rand des Bereichs abschneiden
        const xs = [-g.range, g.range];
        const points = xs.map((x) => [x, m * x + l.b] as const);
        const clip = ([x, y]: readonly [number, number], [x2, y2]: readonly [number, number]): [number, number] => {
          if (y > g.range) return [x + ((g.range - y) * (x2 - x)) / (y2 - y), g.range];
          if (y < -g.range) return [x + ((-g.range - y) * (x2 - x)) / (y2 - y), -g.range];
          return [x, y];
        };
        const [a, b] = [clip(points[0], points[1]), clip(points[1], points[0])];
        // Gitterpunkte, durch die die Gerade genau geht – Lesehilfe fürs Steigungsdreieck
        const lattice = ticks
          .filter((x) => (l.rise * x) % l.run === 0 && Math.abs(l.b + (l.rise * x) / l.run) <= g.range)
          .map((x) => ({ x: px(x), y: py(l.b + (l.rise * x) / l.run) }));
        return { x1: f(px(a[0])), y1: f(py(a[1])), x2: f(px(b[0])), y2: f(py(b[1])), lattice };
      }),
    };
  });
}
