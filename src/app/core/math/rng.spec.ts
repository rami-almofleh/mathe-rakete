import { Rng } from './rng';

describe('Rng', () => {
  it('is reproducible with the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it('stays within bounds and hits both ends', () => {
    const rng = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const n = rng.int(-2, 3);
      expect(n).toBeGreaterThanOrEqual(-2);
      expect(n).toBeLessThanOrEqual(3);
      seen.add(n);
    }
    expect([...seen].sort((x, y) => x - y)).toEqual([-2, -1, 0, 1, 2, 3]);
  });

  it('rejects invalid ranges and empty picks', () => {
    const rng = new Rng(1);
    expect(() => rng.int(5, 1)).toThrow(RangeError);
    expect(() => rng.int(0.5, 3)).toThrow(RangeError);
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it('shuffles into a permutation without touching the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const shuffled = new Rng(3).shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...shuffled].sort()).toEqual(input);
  });
});
