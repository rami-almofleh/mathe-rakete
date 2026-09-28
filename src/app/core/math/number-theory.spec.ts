import { divisors, gcd, isPrime, lcm, primeFactors } from './number-theory';

describe('number theory', () => {
  it('computes gcd and lcm', () => {
    expect(gcd(12, 18)).toBe(6);
    expect(gcd(-12, 18)).toBe(6);
    expect(gcd(7, 0)).toBe(7);
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(0, 5)).toBe(0);
  });

  it('detects primes', () => {
    const primes = Array.from({ length: 30 }, (_, i) => i).filter(isPrime);
    expect(primes).toEqual([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
    expect(isPrime(97)).toBe(true);
    expect(isPrime(91)).toBe(false);
  });

  it('lists divisors and prime factors', () => {
    expect(divisors(36)).toEqual([1, 2, 3, 4, 6, 9, 12, 18, 36]);
    expect(divisors(13)).toEqual([1, 13]);
    expect(primeFactors(360)).toEqual([2, 2, 2, 3, 3, 5]);
    expect(primeFactors(97)).toEqual([97]);
  });
});
