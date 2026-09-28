import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';
import { authRouter } from './auth/routes.js';
import { profilesRouter } from './profiles/routes.js';
import { progressRouter } from './progress/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  // 2 MB statt der Standard-100-kB-Grenze: Der Fortschritt (u. a. Wiederholungsliste, letzte
  // Runden) ist ein einzelner JSON-Blob und kann mit der Zeit größer werden als das Standardlimit.
  app.use(express.json({ limit: '2mb' }));
  // Antworten hängen vom Bearer-Token ab, das der Browser-Cache nicht berücksichtigt (kein
  // `Vary`-Header dafür) – ohne das hier würde z. B. `GET /profiles` nach einem Kontowechsel
  // eine alte, zwischengespeicherte Antwort eines anderen Kontos zeigen (304 statt frischer Daten).
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use('/api/auth', authRouter);
  app.use('/api/profiles', profilesRouter);
  app.use('/api/progress', progressRouter);

  if (env.isProd) {
    // Zur Laufzeit liegt diese Datei unter server/dist/app.js – zwei Ebenen über dem Projekt-
    // Wurzelverzeichnis liegt dist/math-learning/browser (siehe Angular-Build-Ausgabe).
    const browserDir = path.resolve(__dirname, '../../dist/math-learning/browser');
    app.use(express.static(browserDir));
    // SPA-Fallback: jede nicht auf eine Datei oder /api passende GET-Anfrage bekommt index.html,
    // damit Angulars Router auch bei einem harten Reload auf z. B. /fortschritt funktioniert.
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(browserDir, 'index.html')));
  }

  return app;
}
