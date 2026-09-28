import type { RequestHandler } from 'express';

/**
 * Sehr einfache Bremse gegen Brute-Force auf /login und /register – ohne zusätzliche
 * Abhängigkeit. Zählt Versuche je IP in einem festen Zeitfenster; kein verteilter Zustand
 * nötig, da hier immer nur ein einzelner Prozess läuft (pm2 im "fork"-Modus, nicht "cluster").
 */
export function rateLimit(maxAttempts: number, windowMs: number): RequestHandler {
  const attempts = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = attempts.get(key);

    if (!entry || entry.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (entry.count >= maxAttempts) {
      res.status(429).json({ error: 'too_many_attempts' });
      return;
    }
    entry.count++;
    next();
  };
}
