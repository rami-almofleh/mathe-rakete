import { inject, Injectable, signal, untracked } from '@angular/core';
import { ApiClient } from './api-client';
import { LocalApiClient } from './local-api-client';
import { TOKEN_STORAGE } from './token-storage';

/**
 * Ziel für Profile und Fortschritt: im Konto der Server (`ApiClient`), im Gast-Modus nur der
 * Browser (`LocalApiClient`). `ProfileStore` und `ProgressStore` merken davon nichts.
 */
@Injectable({ providedIn: 'root' })
export class DataApi {
  private readonly remote = inject(ApiClient);
  readonly local = new LocalApiClient(inject(TOKEN_STORAGE));

  /** Wird von `AuthService` umgeschaltet. */
  readonly guest = signal(false);

  private get target(): Pick<ApiClient, 'get' | 'post' | 'put' | 'delete'> {
    // untracked: Aufrufe aus einem effect() sollen nicht zusätzlich vom Modus abhängen
    return untracked(this.guest) ? this.local : this.remote;
  }

  get<T>(path: string): Promise<T> {
    return this.target.get<T>(path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.target.post<T>(path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.target.put<T>(path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.target.delete<T>(path);
  }
}
