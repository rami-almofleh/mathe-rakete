import { Router } from 'express';
import { db } from '../db/connection.js';
import { hashPassword, verifyPassword } from './password.js';
import { signToken } from './jwt.js';
import { requireAuth } from './middleware.js';
import { rateLimit } from './rate-limit.js';

export const authRouter = Router();

// 20 Versuche pro 15 Minuten und IP – reicht für normale Nutzung, bremst Brute-Force merklich.
const loginLimiter = rateLimit(20, 15 * 60 * 1000);

const MIN_PASSWORD_LENGTH = 8;

function normalizeEmail(email: unknown): string | null {
  return typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
}

authRouter.post('/register', loginLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!email || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: 'invalid_input' });
    return;
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    res.status(409).json({ error: 'email_taken' });
    return;
  }
  const passwordHash = await hashPassword(password);
  const info = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, passwordHash);
  const user = { id: Number(info.lastInsertRowid), email };
  res.status(201).json({ token: signToken({ sub: user.id, email }), user });
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const row = email ? (db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email) as UserRow | undefined) : undefined;
  if (!row || typeof password !== 'string' || !(await verifyPassword(password, row.password_hash))) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }
  res.json({ token: signToken({ sub: row.id, email: row.email }), user: { id: row.id, email: row.email } });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.userId!);
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ user: row });
});
