import { Rational } from './rational';

const r = Rational.of;

describe('Rational', () => {
  it('normalizes sign and reduces', () => {
    expect(r(2, 4).key()).toBe('1/2');
    expect(r(1, -2).key()).toBe('-1/2');
    expect(r(-3, -6).key()).toBe('1/2');
    expect(r(0, -5).key()).toBe('0/1');
    expect(Object.is(r(0, -5).num, -0)).toBe(false);
  });

  it('rejects zero denominators and non-integers', () => {
    expect(() => r(1, 0)).toThrow(RangeError);
    expect(() => r(0.5, 2)).toThrow(RangeError);
    expect(() => r(1, 2).div(0)).toThrow(RangeError);
  });

  it('does exact arithmetic', () => {
    expect(r(1, 2).add(r(1, 3)).key()).toBe('5/6');
    expect(r(1, 2).sub(r(3, 4)).key()).toBe('-1/4');
    expect(r(2, 3).mul(r(9, 4)).key()).toBe('3/2');
    expect(r(2, 3).div(r(4, 5)).key()).toBe('5/6');
    expect(Rational.decimal(1, 1).add(Rational.decimal(2, 1)).equals(Rational.decimal(3, 1))).toBe(true);
    expect(r(2, 3).pow(2).key()).toBe('4/9');
    expect(r(2).pow(-3).key()).toBe('1/8');
  });

  it('compares values', () => {
    expect(r(1, 3).compare(r(1, 2))).toBe(-1);
    expect(r(2, 4).compare(r(1, 2))).toBe(0);
    expect(r(-1, 2).compare(0)).toBe(-1);
    expect(r(6, 3).isInteger()).toBe(true);
    expect(r(-7, 2).trunc()).toBe(-3);
  });

  it('knows terminating decimals', () => {
    expect(r(3, 4).decimalPlaces()).toBe(2);
    expect(r(1, 8).decimalPlaces()).toBe(3);
    expect(r(7).decimalPlaces()).toBe(0);
    expect(r(1, 3).decimalPlaces()).toBeNull();
    expect(r(1, 6).decimalPlaces()).toBeNull();
  });
});
