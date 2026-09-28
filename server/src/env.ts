import dotenv from 'dotenv';
import path from 'node:path';

export type NodeEnv = 'development' | 'production' | 'test';

const nodeEnv = (process.env.NODE_ENV as NodeEnv) ?? 'development';

// Getrennte Dateien für dev/prod, damit nie versehentlich die falsche Datenbank/das falsche
// Secret geladen wird. `server/.env` für lokale Entwicklung, `server/.env.production` auf dem
// Server (beide gitignored). `override: true`, damit eine bereits von pm2 gesetzte Umgebung
// (z. B. NODE_ENV) durch die Datei ergänzt, aber nicht verworfen wird.
dotenv.config({ path: nodeEnv === 'production' ? '.env.production' : '.env', override: false });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Fehlende Pflicht-Umgebungsvariable ${name} (siehe server/.env.example)`);
  return value;
}

const isProd = nodeEnv === 'production';

export const env = {
  nodeEnv,
  isProd,
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT ?? 3000),
  // In der Entwicklung ein fester Wert, damit `npm run dev` ohne Einrichtung läuft.
  // In Produktion wird ein echtes Secret verlangt.
  jwtSecret: isProd ? required('JWT_SECRET') : (process.env.JWT_SECRET ?? 'dev-only-insecure-secret'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '365d',
  databasePath: isProd
    ? required('DATABASE_PATH')
    : nodeEnv === 'test'
      ? ':memory:'
      : (process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'dev.sqlite')),
} as const;
