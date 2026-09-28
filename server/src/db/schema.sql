CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active_profile_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,               -- vom Client erzeugte UUID, bleibt unverändert
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  grade INTEGER,
  state TEXT NOT NULL,
  total_stars INTEGER NOT NULL DEFAULT 0, -- Cache, wird bei jedem Fortschritt-Update mitgeschrieben
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);

CREATE TABLE IF NOT EXISTS progress (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  data TEXT NOT NULL, -- JSON-Blob, genau die Form von ProgressData im Frontend
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
