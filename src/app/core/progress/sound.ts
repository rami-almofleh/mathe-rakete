import { inject, Injectable } from '@angular/core';
import { ProgressStore } from './progress-store';

type SoundKind = 'correct' | 'wrong' | 'finish';

/** Tonfolgen in Hz – kurz und freundlich, ohne Audiodateien. */
const MELODIES: Record<SoundKind, readonly number[]> = {
  correct: [660, 880],
  wrong: [300, 220],
  finish: [523, 659, 784, 1047],
};

/** Kurze Klänge über die Web-Audio-API; standardmäßig aus, in der Navigation einschaltbar. */
@Injectable({ providedIn: 'root' })
export class SoundService {
  private readonly progress = inject(ProgressStore);
  private context?: AudioContext;

  play(kind: SoundKind): void {
    if (!this.progress.sound()) return;
    try {
      this.context ??= new AudioContext();
      const ctx = this.context;
      MELODIES[kind].forEach((frequency, i) => {
        const start = ctx.currentTime + i * 0.11;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = kind === 'wrong' ? 'triangle' : 'sine';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.2);
      });
    } catch {
      // kein Audio verfügbar – Töne sind nur ein Extra
    }
  }
}
