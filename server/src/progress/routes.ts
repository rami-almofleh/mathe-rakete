import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireAuth } from '../auth/middleware.js';

export const progressRouter = Router();
progressRouter.use(requireAuth);

// Muss mit EMPTY_PROGRESS in src/app/core/progress/progress-store.ts übereinstimmen.
const EMPTY_PROGRESS_JSON = JSON.stringify({
  version: 1,
  totalStars: 0,
  roundsPlayed: 0,
  bestStreak: 0,
  topics: {},
  recentRounds: [],
  badges: [],
  lastSettings: {},
  mistakes: [],
  sound: false,
});

function ownsProfile(profileId: string, userId: number): boolean {
  return !!db.prepare('SELECT 1 FROM profiles WHERE id = ? AND user_id = ?').get(profileId, userId);
}

progressRouter.get('/:profileId', (req, res) => {
  const userId = req.userId!;
  if (!ownsProfile(req.params.profileId, userId)) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const row = db.prepare('SELECT data FROM progress WHERE profile_id = ?').get(req.params.profileId) as { data: string } | undefined;
  res.type('application/json').send(row?.data ?? EMPTY_PROGRESS_JSON);
});

progressRouter.put('/:profileId', (req, res) => {
  const userId = req.userId!;
  if (!ownsProfile(req.params.profileId, userId)) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const data = req.body as { version?: number; totalStars?: number } | null;
  if (!data || data.version !== 1) {
    res.status(400).json({ error: 'invalid_data' });
    return;
  }
  const json = JSON.stringify(data);
  db.prepare(
    `INSERT INTO progress (profile_id, data, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(profile_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(req.params.profileId, json);
  db.prepare('UPDATE profiles SET total_stars = ? WHERE id = ?').run(Number(data.totalStars) || 0, req.params.profileId);
  res.status(204).end();
});
