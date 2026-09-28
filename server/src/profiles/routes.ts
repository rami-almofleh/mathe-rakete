import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireAuth } from '../auth/middleware.js';

export const profilesRouter = Router();
profilesRouter.use(requireAuth);

const MAX_NAME_LENGTH = 20;

interface ProfileRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  grade: number | null;
  state: string;
  total_stars: number;
}

function ownedProfile(id: string, userId: number): ProfileRow | undefined {
  return db.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(id, userId) as ProfileRow | undefined;
}

function toWire(r: ProfileRow) {
  return { id: r.id, name: r.name, icon: r.icon, color: r.color, grade: r.grade, state: r.state };
}

function isValidDraft(body: unknown): body is { name: string; icon: string; color: string; grade: number | null; state: string } {
  const b = body as Record<string, unknown> | null;
  return !!b && typeof b['name'] === 'string' && b['name'].trim().length > 0 && typeof b['icon'] === 'string' && typeof b['color'] === 'string' && typeof b['state'] === 'string' && (b['grade'] === null || b['grade'] === undefined || typeof b['grade'] === 'number');
}

/** Alle Profile des Kontos + Ø aktives Profil + Sterne je Profil in einer Antwort (fürs Hydrieren). */
profilesRouter.get('/', (req, res) => {
  const userId = req.userId!;
  const rows = db.prepare('SELECT * FROM profiles WHERE user_id = ? ORDER BY created_at').all(userId) as ProfileRow[];
  const user = db.prepare('SELECT active_profile_id FROM users WHERE id = ?').get(userId) as { active_profile_id: string | null };
  res.json({
    profiles: rows.map(toWire),
    activeId: user.active_profile_id,
    totalStars: Object.fromEntries(rows.map((r) => [r.id, r.total_stars])),
  });
});

profilesRouter.post('/', (req, res) => {
  const userId = req.userId!;
  if (!isValidDraft(req.body)) {
    res.status(400).json({ error: 'invalid_input' });
    return;
  }
  const { id, name, icon, color, grade, state } = req.body as { id?: string; name: string; icon: string; color: string; grade: number | null; state: string };
  const profileId = typeof id === 'string' && id ? id : randomUUID();
  const trimmedName = name.trim().slice(0, MAX_NAME_LENGTH);
  db.prepare('INSERT INTO profiles (id, user_id, name, icon, color, grade, state) VALUES (?,?,?,?,?,?,?)').run(
    profileId,
    userId,
    trimmedName,
    icon,
    color,
    grade ?? null,
    state,
  );
  db.prepare('UPDATE users SET active_profile_id = ? WHERE id = ?').run(profileId, userId);
  res.status(201).json({ id: profileId, name: trimmedName, icon, color, grade: grade ?? null, state });
});

// WICHTIG: '/active' muss VOR '/:id' stehen – Express prüft Routen in Deklarationsreihenfolge,
// sonst würde PUT /active von PUT /:id verschluckt (id würde dann "active" sein).
profilesRouter.put('/active', (req, res) => {
  const userId = req.userId!;
  const { id } = (req.body ?? {}) as { id?: string | null };
  if (id !== null && id !== undefined && (typeof id !== 'string' || !ownedProfile(id, userId))) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  db.prepare('UPDATE users SET active_profile_id = ? WHERE id = ?').run(id ?? null, userId);
  res.status(204).end();
});

profilesRouter.put('/:id', (req, res) => {
  const userId = req.userId!;
  if (!ownedProfile(req.params.id, userId)) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  if (!isValidDraft(req.body)) {
    res.status(400).json({ error: 'invalid_input' });
    return;
  }
  const { name, icon, color, grade, state } = req.body as { name: string; icon: string; color: string; grade: number | null; state: string };
  const trimmedName = name.trim().slice(0, MAX_NAME_LENGTH);
  db.prepare("UPDATE profiles SET name=?, icon=?, color=?, grade=?, state=?, updated_at=datetime('now') WHERE id=?").run(
    trimmedName,
    icon,
    color,
    grade ?? null,
    state,
    req.params.id,
  );
  res.json({ id: req.params.id, name: trimmedName, icon, color, grade: grade ?? null, state });
});

profilesRouter.delete('/:id', (req, res) => {
  const userId = req.userId!;
  if (!ownedProfile(req.params.id, userId)) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  db.prepare('DELETE FROM profiles WHERE id = ?').run(req.params.id); // löscht per FK-Kaskade auch den Fortschritt
  const user = db.prepare('SELECT active_profile_id FROM users WHERE id = ?').get(userId) as { active_profile_id: string | null };
  if (user.active_profile_id === req.params.id) {
    const next = db.prepare('SELECT id FROM profiles WHERE user_id = ? ORDER BY created_at LIMIT 1').get(userId) as { id: string } | undefined;
    db.prepare('UPDATE users SET active_profile_id = ? WHERE id = ?').run(next?.id ?? null, userId);
  }
  res.status(204).end();
});
