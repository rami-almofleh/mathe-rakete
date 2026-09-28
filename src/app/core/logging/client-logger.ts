import { ErrorHandler, inject, Injectable } from '@angular/core';
import { TOKEN_KEY, TOKEN_STORAGE } from '../auth/token-storage';

export type ReportKind = 'error' | 'stuck' | 'chunk-reload' | 'api';

interface Breadcrumb {
  readonly at: string;
  readonly event: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

const MAX_BREADCRUMBS = 40;
/** Pro Seitenaufruf höchstens so viele Berichte – ein Fehler in einer Endlosschleife soll das Log nicht fluten. */
const MAX_REPORTS = 200;
/** Derselbe Fehler wird höchstens so oft gemeldet (Wiederholungen dazwischen werden mitgezählt). */
const REPEAT_WINDOW_MS = 10_000;

/**
 * Schickt Fehler und „hängt fest“-Meldungen aus dem Browser an `/api/logs` (landen in `pm2 logs`).
 * Dazu die letzten Schritte davor („Brotkrumen“, z. B. Quiz-Ereignisse), damit sich nachvollziehen
 * lässt, was unmittelbar vorher passiert ist.
 */
@Injectable({ providedIn: 'root' })
export class ClientLogger {
  private readonly storage = inject(TOKEN_STORAGE);
  private readonly breadcrumbs: Breadcrumb[] = [];
  /** Letzter Versand je Fehler + wie oft er seitdem erneut auftrat */
  private readonly recent = new Map<string, { sentAt: number; repeats: number }>();
  private reportCount = 0;

  breadcrumb(event: string, data?: Record<string, unknown>): void {
    this.breadcrumbs.push({ at: new Date().toISOString().slice(11, 23), event, data });
    if (this.breadcrumbs.length > MAX_BREADCRUMBS) this.breadcrumbs.shift();
  }

  report(kind: ReportKind, message: string, details: { stack?: string; context?: Record<string, unknown> } = {}): void {
    try {
      console.warn(`[mathe-rakete] ${kind}: ${message}`, details.context ?? '', details.stack ?? '');
      if (this.reportCount >= MAX_REPORTS) return;
      // Jeder Fehler wird gemeldet; nur exakt derselbe in schneller Folge (z. B. bei jedem Neuzeichnen)
      // wird gebündelt und beim nächsten Versand als „repeats“ mitgezählt.
      const key = `${kind}|${message}`;
      const now = Date.now();
      const last = this.recent.get(key);
      if (last && now - last.sentAt < REPEAT_WINDOW_MS) {
        last.repeats++;
        return;
      }
      const repeats = last?.repeats ?? 0;
      this.recent.set(key, { sentAt: now, repeats: 0 });
      this.reportCount++;

      const token = this.readToken();
      void fetch('/api/logs', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          kind,
          message,
          stack: details.stack,
          url: location.pathname,
          context: {
            ...details.context,
            ...(repeats ? { repeatsSinceLastReport: repeats } : {}),
            viewport: `${innerWidth}x${innerHeight}`,
            touch: matchMedia('(pointer: coarse)').matches,
            online: navigator.onLine,
          },
          breadcrumbs: this.breadcrumbs,
        }),
      }).catch(() => {});
    } catch {
      // Logging darf selbst nie etwas kaputt machen
    }
  }

  private readToken(): string | null {
    try {
      return this.storage?.getItem(TOKEN_KEY) ?? null;
    } catch {
      return null;
    }
  }
}

/** Ersetzt Angulars Standard-Fehlerbehandlung: weiterhin Konsole, zusätzlich Bericht an den Server. */
@Injectable()
export class ReportingErrorHandler implements ErrorHandler {
  private readonly logger = inject(ClientLogger);

  handleError(error: unknown): void {
    console.error(error);
    const err = error instanceof Error ? error : new Error(String(error));
    this.logger.report('error', err.message, { stack: err.stack });
  }
}
