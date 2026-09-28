import { Polynomial } from './polynomial';

describe('Polynomial', () => {
  it('multiplies and expands binomials', () => {
    const p = Polynomial.of(5, 1).pow(2); // (x + 5)²
    expect(p.format()).toBe('x^{2} + 10x + 25');
    expect(Polynomial.of(-3, 1).mul(Polynomial.of(3, 1)).format()).toBe('x^{2} - 9');
    expect(Polynomial.fromRoots(2, 3).format('plain')).toBe('x² − 5x + 6');
  });

  it('evaluates, derives and integrates', () => {
    const p = Polynomial.fromHighest(3, -2, 7); // 3x² − 2x + 7
    expect(p.evaluate(2).num).toBe(15);
    expect(p.derivative().format()).toBe('6x - 2');
    expect(p.antiderivative().format()).toBe('x^{3} - x^{2} + 7x');
    expect(p.degree).toBe(2);
  });

  it('formats edge cases', () => {
    expect(Polynomial.of(0).format()).toBe('0');
    expect(Polynomial.of(0, -1).format()).toBe('-x');
    expect(Polynomial.fromHighest(-1, 0, 4).format('plain')).toBe('−x² + 4');
    expect(Polynomial.of(1, 2).equals(Polynomial.of(1, 2, 0))).toBe(true);
  });
});
