import { formatDecimal, formatFraction, formatInteger, formatOperand, formatRounded } from './format';
import { Rational } from './rational';

const NNBSP = ' ';
const MINUS = '−';

describe('format', () => {
  it('groups thousands and uses a real minus sign', () => {
    expect(formatInteger(999)).toBe('999');
    expect(formatInteger(1000)).toBe(`1${NNBSP}000`);
    expect(formatInteger(45312)).toBe(`45${NNBSP}312`);
    expect(formatInteger(-1234567)).toBe(`${MINUS}1${NNBSP}234${NNBSP}567`);
    expect(formatInteger(-7, 'tex')).toBe('-7');
    expect(formatInteger(12000, 'tex')).toBe('12\\,000');
  });

  it('writes decimals with a comma', () => {
    expect(formatDecimal(Rational.decimal(345, 2))).toBe('3,45');
    expect(formatDecimal(Rational.of(-1, 4))).toBe(`${MINUS}0,25`);
    expect(formatDecimal(Rational.of(5))).toBe('5');
    expect(formatDecimal(Rational.decimal(123456, 1))).toBe(`12${NNBSP}345,6`);
    expect(formatDecimal(Rational.decimal(25, 1), 'tex')).toBe('2{,}5');
    expect(() => formatDecimal(Rational.of(1, 3))).toThrow(RangeError);
  });

  it('rounds half up', () => {
    expect(formatRounded(Math.PI * 25, 2)).toBe('78,54');
    expect(formatRounded(1.005, 2)).toBe('1,01');
    expect(formatRounded(-2.5, 0)).toBe(`${MINUS}3`);
    expect(formatRounded(Rational.of(1, 3), 3)).toBe('0,333');
  });

  it('writes fractions', () => {
    expect(formatFraction(Rational.of(3, 4))).toBe('3/4');
    expect(formatFraction(Rational.of(-3, 4), 'tex')).toBe('-\\frac{3}{4}');
    expect(formatFraction(Rational.of(8, 4))).toBe('2');
  });

  it('wraps negative operands in brackets', () => {
    expect(formatOperand(Rational.of(-7))).toBe(`(${MINUS}7)`);
    expect(formatOperand(Rational.of(7))).toBe('7');
    expect(formatOperand(Rational.of(-1, 2), 'fraction', 'tex')).toBe('\\left(-\\frac{1}{2}\\right)');
  });
});
