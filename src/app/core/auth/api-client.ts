import { inject, Injectable, signal } from '@angular/core';
import { ClientLogger } from '../logging/client-logger';
import { TOKEN_KEY, TOKEN_STORAGE } from './token-storage';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API-Fehler ${status}`);
  }
}

/** Hängt eine Anfrage länger, wird sie abgebrochen (und z. B. beim Speichern später wiederholt). */
const REQUEST_TIMEOUT_MS = 15_000;

/** Kleiner fetch-Wrapper: hängt das Login-Token an, meldet 401 zentral (siehe `AuthService`). */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly storage = inject(TOKEN_STORAGE);
  private readonly logger = inject(ClientLogger);

  /** Zählt hoch bei jeder 401-Antwort – `AuthService` meldet das Kind dann ab. */
  readonly unauthorized = signal(0);

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = this.readToken();
    const started = Date.now();
    let res: Response;
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
    try {
      res = await fetch(`/api${path}`, {
        method,
        signal: abort.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      // Viele Aufrufe laufen still im Hintergrund – ohne diesen Bericht bliebe ein Verbindungsproblem unsichtbar
      const timedOut = abort.signal.aborted;
      this.logger.report('api', `${method} ${path} fehlgeschlagen: ${timedOut ? `keine Antwort nach ${REQUEST_TIMEOUT_MS / 1000} s` : (error as Error).message}`, {
        context: { ms: Date.now() - started },
      });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    if (res.status >= 500) {
      this.logger.report('api', `${method} ${path} → ${res.status}`, { context: { ms: Date.now() - started } });
    }
    if (res.status === 401) {
      this.unauthorized.update((n) => n + 1);
    }
    if (!res.ok) {
      throw new ApiError(res.status, await res.json().catch(() => null));
    }
    if (res.status === 204) {
      return undefined as T;
    }
    return res.json() as Promise<T>;
  }

  private readToken(): string | null {
    try {
      return this.storage?.getItem(TOKEN_KEY) ?? null;
    } catch {
      return null;
    }
  }
}
