import { LocalApiClient } from '../auth/local-api-client';

/**
 * Ersetzt `ApiClient` in Tests: dieselben Endpunkte wie der Gast-Speicher (und damit wie
 * `server/src/profiles/routes.ts` / `server/src/progress/routes.ts`), rein im Speicher, ohne Netzwerk.
 */
export class FakeApiClient extends LocalApiClient {
  /** Lässt den nächsten Aufruf scheitern (simuliert Server/Verbindung nicht erreichbar), dann wieder normal. */
  failNext = false;

  constructor() {
    super(null);
  }

  hasProgress(profileId: string): boolean {
    return profileId in this.snapshot().progress;
  }

  override async get<T>(path: string): Promise<T> {
    this.maybeFail();
    return super.get<T>(path);
  }

  override async post<T>(path: string, body?: unknown): Promise<T> {
    this.maybeFail();
    return super.post<T>(path, body);
  }

  override async put<T>(path: string, body?: unknown): Promise<T> {
    this.maybeFail();
    return super.put<T>(path, body);
  }

  override async delete<T>(path: string): Promise<T> {
    this.maybeFail();
    return super.delete<T>(path);
  }

  private maybeFail(): void {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Netzwerkfehler (simuliert)');
    }
  }
}
