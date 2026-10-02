import { Component, computed, input } from '@angular/core';
import { formatInteger } from '../../core/math/format';
import { AngleFigure, BarChartFigure, ClockFigure, Figure, FractionFigure, GraphFigure, GridFigure, NumberLineFigure, SolidShape, UrnFigure } from '../../core/models';

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
      return figure.axis ? 'Kästchengitter mit gefärbten Kästchen und einer roten Spiegelachse' : 'Kästchengitter mit einer gefärbten Figur';
    case 'angle':
      return 'Winkel zwischen zwei Schenkeln';
    case 'fraction':
      return `${figure.shape === 'circle' ? 'Kreis' : 'Streifen'} in ${figure.parts} gleiche Teile geteilt, ${figure.filled.length} davon gefärbt`;
    case 'graph':
      return 'Koordinatensystem mit einer Geraden';
    case 'numberline':
      return 'Zahlenstrahl mit einem Pfeil';
    case 'bars':
      return `Säulendiagramm mit ${figure.bars.length} Säulen: ${figure.bars.map((b) => b.label).join(', ')}`;
    case 'solid':
      return 'Zeichnung eines geometrischen Körpers';
    case 'urn':
      return figure.bags
        .map((bag) => `${bag.label ?? 'Beutel'}: ${bag.balls.filter((b) => b.count).map((b) => `${b.count} ${b.color}`).join(', ')}`)
        .join('; ');
  }
}

type Pt = readonly [number, number];
const path = (...points: Pt[]) => 'M ' + points.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L ');
const closed = (...points: Pt[]) => path(...points) + ' Z';
const plus = ([x, y]: Pt, [dx, dy]: Pt): Pt => [x + dx, y + dy];
/** Halbe Ellipse: vordere (unten) oder hintere (oben) Hälfte */
const halfEllipse = (cx: number, cy: number, rx: number, ry: number, front: boolean) =>
  `M ${f(cx - rx)} ${f(cy)} A ${rx} ${ry} 0 0 ${front ? 0 : 1} ${f(cx + rx)} ${f(cy)}`;

interface SolidDrawing {
  /** sichtbare Flächen (leicht gefärbt) */
  readonly faces: readonly string[];
  readonly edges: readonly string[];
  /** verdeckte Kanten */
  readonly hidden: readonly string[];
}

/** Quader in Schrägbild: Vorderfläche w × h, Tiefe nach rechts oben */
function box(w: number, h: number, depth: Pt): SolidDrawing {
  const [x, y] = [100 - (w + depth[0]) / 2, 150 - h];
  const A: Pt = [x, y + h], B: Pt = [x + w, y + h], C: Pt = [x + w, y], D: Pt = [x, y];
  const [A2, B2, C2, D2] = [A, B, C, D].map((p) => plus(p, depth));
  return {
    faces: [closed(A, B, C, D), closed(D, C, C2, D2), closed(B, B2, C2, C)],
    edges: [closed(A, B, C, D), path(D, D2, C2, B2, B), path(C, C2)],
    hidden: [path(A, A2), path(A2, B2), path(A2, D2)],
  };
}

function solidDrawing(shape: SolidShape): SolidDrawing {
  switch (shape) {
    case 'cube':
      return box(80, 80, [40, -35]);
    case 'cuboid':
      return box(120, 60, [35, -30]);
    case 'pyramid': {
      const [P1, P2, P3, P4, S]: Pt[] = [[35, 150], [125, 150], [170, 118], [80, 118], [102, 22]];
      return {
        faces: [closed(P1, P2, S), closed(P2, P3, S)],
        edges: [path(P1, P2, P3), path(P1, S, P3), path(P2, S)],
        hidden: [path(P3, P4, P1), path(P4, S)],
      };
    }
    case 'prism': {
      const [T1, T2, T3]: Pt[] = [[30, 150], [100, 150], [65, 85]];
      const depth: Pt = [70, -35];
      const [U1, U2, U3] = [T1, T2, T3].map((p) => plus(p, depth));
      return {
        faces: [closed(T1, T2, T3), closed(T2, U2, U3, T3)],
        edges: [closed(T1, T2, T3), path(T3, U3, U2, T2)],
        hidden: [path(T1, U1), path(U1, U2), path(U1, U3)],
      };
    }
    case 'cylinder':
      return {
        faces: [`M 50 40 L 50 140 ${halfEllipse(100, 140, 50, 14, true).replace('M 50.00 140.00', '')} L 150 40 Z`],
        edges: ['M 50 40 L 50 140', 'M 150 40 L 150 140', 'M 50 40 A 50 14 0 1 0 150 40 A 50 14 0 1 0 50 40', halfEllipse(100, 140, 50, 14, true)],
        hidden: [halfEllipse(100, 140, 50, 14, false)],
      };
    case 'cone':
      return {
        faces: [`M 100 18 L 45 140 ${halfEllipse(100, 140, 55, 15, true).replace('M 45.00 140.00', '')} Z`],
        edges: ['M 100 18 L 45 140', 'M 100 18 L 155 140', halfEllipse(100, 140, 55, 15, true)],
        hidden: [halfEllipse(100, 140, 55, 15, false)],
      };
    case 'sphere':
      return {
        faces: ['M 40 85 A 60 60 0 1 0 160 85 A 60 60 0 1 0 40 85'],
        edges: ['M 40 85 A 60 60 0 1 0 160 85 A 60 60 0 1 0 40 85', halfEllipse(100, 85, 60, 16, true)],
        hidden: [halfEllipse(100, 85, 60, 16, false)],
      };
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
      // Spiegelachse ragt ein Stück über das Gitter hinaus
      axis: g.axis
        ? g.axis.orientation === 'vertical'
          ? { x1: g.axis.at * size + 1, y1: -6, x2: g.axis.at * size + 1, y2: g.rows * size + 8 }
          : { x1: -6, y1: g.axis.at * size + 1, x2: g.columns * size + 8, y2: g.axis.at * size + 1 }
        : null,
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

  // ---- Zahlenstrahl ----------------------------------------------------------------------------
  protected readonly numberLine = computed(() => {
    const fig = this.figure();
    if (fig.kind !== 'numberline') return null;
    const nl: NumberLineFigure = fig;
    const x = (v: number) => 20 + ((v - nl.start) / (nl.end - nl.start)) * 280;
    const count = Math.round((nl.end - nl.start) / nl.step);
    return {
      ticks: Array.from({ length: count + 1 }, (_, i) => {
        const value = nl.start + i * nl.step;
        const labelled = value % nl.labelEvery === 0;
        return { x: f(x(value)), labelled, label: labelled ? formatInteger(value) : '' };
      }),
      arrow: f(x(nl.marked)),
      arrowHead: `M ${f(x(nl.marked) - 6)} 30 L ${f(x(nl.marked))} 40 L ${f(x(nl.marked) + 6)} 30`,
    };
  });

  // ---- Säulendiagramm --------------------------------------------------------------------------
  protected readonly barChart = computed(() => {
    const fig = this.figure();
    if (fig.kind !== 'bars') return null;
    const bc: BarChartFigure = fig;
    const [left, right, top, bottom] = [40, 292, 12, 160];
    const y = (v: number) => bottom - (v / bc.max) * (bottom - top);
    const slot = (right - left) / bc.bars.length;
    const width = slot * 0.56;
    return {
      left,
      right,
      bottom,
      grid: Array.from({ length: Math.round(bc.max / bc.gridStep) + 1 }, (_, i) => {
        const value = i * bc.gridStep;
        return { y: f(y(value)), labelY: f(y(value) + 4), label: value % bc.labelStep === 0 ? formatInteger(value) : '' };
      }),
      bars: bc.bars.map((b, i) => ({
        x: f(left + i * slot + (slot - width) / 2),
        y: f(y(b.value)),
        width: f(width),
        height: f(bottom - y(b.value)),
        center: f(left + i * slot + slot / 2),
        label: b.label,
        color: i % 5,
      })),
    };
  });

  // ---- Körper ------------------------------------------------------------------------------------
  protected readonly solid = computed(() => {
    const fig = this.figure();
    return fig.kind === 'solid' ? solidDrawing(fig.shape) : null;
  });

  // ---- Kugeln im Beutel ----------------------------------------------------------------------------
  protected readonly urn = computed(() => {
    const fig = this.figure();
    if (fig.kind !== 'urn') return null;
    const u: UrnFigure = fig;
    const bagWidth = 130;
    const gap = 20;
    const perRow = 5;
    const r = 10;
    return {
      width: u.bags.length * bagWidth + (u.bags.length - 1) * gap,
      bags: u.bags.map((bag, b) => {
        const x0 = b * (bagWidth + gap);
        // Farben gemischt wie im echten Beutel – aber feste Reihenfolge, damit das Bild nicht springt
        const colors = bag.balls.flatMap((ball) => Array.from({ length: ball.count }, () => ball.color));
        const mixed = colors.map((c, i) => ({ c, k: (i * 7) % colors.length })).sort((a, z) => a.k - z.k).map((e) => e.c);
        const rows = Math.ceil(mixed.length / perRow);
        return {
          label: bag.label ?? '',
          labelX: x0 + bagWidth / 2,
          outline: `M ${x0 + 12} 30 Q ${x0} 160 ${x0 + bagWidth / 2} 160 Q ${x0 + bagWidth} 160 ${x0 + bagWidth - 12} 30 Z`,
          tie: `M ${x0 + 20} 30 L ${x0 + bagWidth - 20} 30`,
          balls: mixed.map((color, i) => {
            const row = Math.floor(i / perRow);
            const inRow = Math.min(perRow, mixed.length - row * perRow);
            const col = i % perRow;
            return {
              color,
              cx: f(x0 + bagWidth / 2 + (col - (inRow - 1) / 2) * (2 * r + 3)),
              cy: f(145 - (rows - 1 - row) * (2 * r + 3) - r),
              r,
            };
          }),
        };
      }),
    };
  });
}
