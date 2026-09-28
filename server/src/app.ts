import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';
import { authRouter } from './auth/routes.js';
import { profilesRouter } from './profiles/routes.js';
import { progressRouter } from './progress/routes.js';
import { logsRouter } from './logs/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  // Hinter nginx/Caddy (gleicher Server): echte Client-IP aus X-Forwarded-For übernehmen – sonst
  // sähe die Login-Bremse alle Nutzer als 127.0.0.1 und würde sie gemeinsam sperren.
  app.set('trust proxy', 'loopback');

  // Kurzes Zugriffsprotokoll für die API (landet in pm2 out.log) – hilft beim Nachverfolgen.
  if (!env.isTest) {
    app.use('/api', (req, res, next) => {
      const started = Date.now();
      res.on('finish', () => {
        const line = `[api] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms user=${req.userId ?? '-'} ip=${req.ip}`;
        if (res.statusCode >= 500) console.error(line);
        else console.log(line);
      });
      next();
    });
  }
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
  app.use('/api/logs', logsRouter);

  // Unerwartete Fehler in Routen: mit Stack ins Log, dem Browser nur eine knappe Antwort
  app.use('/api', ((err, req, res, _next) => {
    console.error(`[api-error] ${req.method} ${req.originalUrl}`, err);
    res.status(500).json({ error: 'internal_error' });
  }) as express.ErrorRequestHandler);

  if (env.isProd) {
    // Zur Laufzeit liegt diese Datei unter server/dist/app.js – zwei Ebenen über dem Projekt-
    // Wurzelverzeichnis liegt dist/math-learning/browser (siehe Angular-Build-Ausgabe).
    const browserDir = path.resolve(__dirname, '../../dist/math-learning/browser');
    app.use(express.static(browserDir));
    // SPA-Fallback: jede nicht auf eine Datei oder /api passende GET-Anfrage bekommt index.html,
    // damit Angulars Router auch bei einem harten Reload auf z. B. /fortschritt funktioniert.
    // Fehlende Dateien (z. B. chunk-*.js eines älteren Builds) bekommen eine echte 404 statt index.html –
    // sonst würde der Browser HTML als JavaScript laden und mit einem verwirrenden Fehler abbrechen.
    app.get(/^(?!\/api\/).*\.[a-z0-9]+$/i, (_req, res) => res.status(404).end());
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.set('Cache-Control', 'no-cache'); // index.html immer frisch, damit nach Updates die neuen Dateinamen geladen werden
      res.sendFile(path.join(browserDir, 'index.html'));
    });
  }

  return app;
}
