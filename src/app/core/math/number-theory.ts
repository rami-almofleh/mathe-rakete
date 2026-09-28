export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) {
    return 0;
  }
  return Math.abs((a / gcd(a, b)) * b);
}

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) {
    return false;
  }
  if (n % 2 === 0) {
    return n === 2;
  }
  for (let d = 3; d * d <= n; d += 2) {
    if (n % d === 0) {
      return false;
    }
  }
  return true;
}

/** Alle positiven Teiler, aufsteigend sortiert. */
export function divisors(n: number): number[] {
  n = Math.abs(n);
  const small: number[] = [];
  const large: number[] = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d === 0) {
      small.push(d);
      if (d * d !== n) {
        large.unshift(n / d);
      }
    }
  }
  return [...small, ...large];
}

/** Primfaktorzerlegung, z. B. 12 → [2, 2, 3]. */
export function primeFactors(n: number): number[] {
  n = Math.abs(n);
  const factors: number[] = [];
  for (let d = 2; d * d <= n; d++) {
    while (n % d === 0) {
      factors.push(d);
      n /= d;
    }
  }
  if (n > 1) {
    factors.push(n);
  }
  return factors;
}
