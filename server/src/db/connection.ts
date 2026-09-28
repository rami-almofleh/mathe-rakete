import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../env.js';

if (env.databasePath !== ':memory:') {
  mkdirSync(dirname(env.databasePath), { recursive: true });
}

export const db = new Database(env.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));
db.exec(readFileSync(schemaPath, 'utf8'));

/** Nur für Tests: leert alle Tabellen, ohne das Schema neu anzulegen. */
export function resetDb(): void {
  db.exec('DELETE FROM progress; DELETE FROM profiles; DELETE FROM users;');
}
