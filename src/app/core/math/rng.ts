/**
 * Seedbarer Zufallsgenerator (mulberry32). Mit festem Seed sind alle Aufgaben
 * reproduzierbar – wichtig für Tests und zum Nachstellen von Fehlern.
 */
export class Rng {
  private state: number;

  constructor(readonly seed: number = Rng.randomSeed()) {
    this.state = seed >>> 0;
  }

  static randomSeed(): number {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }

  /** Gleichverteilt in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Ganze Zahl in [min, max] (beide inklusive). */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new RangeError(`Ungültiger Bereich [${min}, ${max}]`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError('Aus einer leeren Liste kann nichts gewählt werden');
    }
    return items[this.int(0, items.length - 1)];
  }

  /** Zufälliges Element, gewichtet (Gewichte > 0). */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    const weights = items.map(weight);
    const total = weights.reduce((a, b) => a + b, 0);
    let x = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      x -= weights[i];
      if (x < 0) return items[i];
    }
    return items[items.length - 1];
  }

  /** Gemischte Kopie (Fisher-Yates); das Original bleibt unverändert. */
  shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  sign(): 1 | -1 {
    return this.chance(0.5) ? 1 : -1;
  }
}
