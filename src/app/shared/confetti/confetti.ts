import { Component } from '@angular/core';

const COLORS = ['var(--ml-sun)', 'var(--ml-mint)', 'var(--ml-sky)', 'var(--ml-coral)', 'var(--ml-primary)'];

interface Piece {
  readonly left: number;
  readonly delay: number;
  readonly duration: number;
  readonly color: string;
  readonly size: number;
  readonly rotate: number;
}

/** Einmaliger Konfetti-Regen (rein dekorativ, bei „weniger Bewegung“ praktisch aus). */
@Component({
  selector: 'app-confetti',
  template: `
    @for (p of pieces; track $index) {
      <span
        class="piece"
        [style.left.%]="p.left"
        [style.animation-delay.ms]="p.delay"
        [style.animation-duration.ms]="p.duration"
        [style.background]="p.color"
        [style.width.px]="p.size"
        [style.height.px]="p.size * 0.45"
        [style.rotate.deg]="p.rotate"
      ></span>
    }
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 1050;
    }
    .piece {
      position: absolute;
      top: -5vh;
      border-radius: 2px;
      opacity: 0;
      animation-name: fall;
      animation-timing-function: cubic-bezier(0.3, 0.6, 0.6, 1);
      animation-fill-mode: forwards;
    }
    @keyframes fall {
      0% { opacity: 1; transform: translateY(0) rotate(0); }
      100% { opacity: 0.9; transform: translateY(110vh) rotate(720deg); }
    }
  `,
  host: { 'aria-hidden': 'true' },
})
export class Confetti {
  protected readonly pieces: Piece[] = Array.from({ length: 60 }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 600,
    duration: 1800 + Math.random() * 1400,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 8 + Math.random() * 8,
    rotate: Math.random() * 180,
  }));
}
