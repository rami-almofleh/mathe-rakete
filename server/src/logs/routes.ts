import { Router } from 'express';
import { verifyToken } from '../auth/jwt.js';
import { rateLimit } from '../auth/rate-limit.js';

export const logsRouter = Router();

// Fehlerberichte aus dem Browser – großzügig genug für echte Fehler, aber kein Weg, das Log zu fluten.
const logLimiter = rateLimit(120, 60 * 1000);

const MAX_FIELD = 4000;

function clip(value: unknown): unknown {
  if (typeof value === 'string') return value.slice(0, MAX_FIELD);
  if (value === null || typeof value !== 'object') return value;
  const json = JSON.stringify(value);
  return json.length > MAX_FIELD ? json.slice(0, MAX_FIELD) + '…' : value;
}

/** Nimmt Fehler/Hänger aus dem Browser entgegen und schreibt sie als eine JSON-Zeile ins Server-Log (pm2). */
logsRouter.post('/', logLimiter, (req, res) => {
  const body = req.body ?? {};
  let userId: number | undefined;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      userId = verifyToken(header.slice(7)).sub;
    } catch {
      // abgelaufenes Token – Bericht trotzdem annehmen
    }
  }
  const entry = {
    time: new Date().toISOString(),
    kind: clip(body.kind),
    message: clip(body.message),
    stack: clip(body.stack),
    url: clip(body.url),
    userAgent: clip(req.headers['user-agent']),
    userId,
    context: clip(body.context),
    breadcrumbs: clip(body.breadcrumbs),
  };
  console.error(`[client] ${JSON.stringify(entry)}`);
  res.status(204).end();
});
