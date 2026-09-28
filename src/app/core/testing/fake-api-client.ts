import { Profile } from '../progress/profile-store';
import type { ProgressData } from '../progress/progress-store';

/**
 * Ersetzt `ApiClient` in Tests: bildet dieselben Endpunkte wie `server/src/profiles/routes.ts`
 * und `server/src/progress/routes.ts` rein im Speicher nach, ohne echtes Netzwerk.
 */
export class FakeApiClient {
  private profiles: Profile[] = [];
  private activeId: string | null = null;
  private totalStars: Record<string, number> = {};
  private progress = new Map<string, ProgressData>();

  /** Lässt den nächsten Aufruf scheitern (simuliert Server/Verbindung nicht erreichbar), dann wieder normal. */
  failNext = false;

  hasProgress(profileId: string): boolean {
    return this.progress.has(profileId);
  }

  async get<T>(path: string): Promise<T> {
    this.maybeFail();
    if (path === '/profiles') {
      return { profiles: this.profiles, activeId: this.activeId, totalStars: this.totalStars } as T;
    }
    const progressId = path.match(/^\/progress\/(.+)$/)?.[1];
    if (progressId) {
      return (this.progress.get(progressId) ?? null) as T;
    }
    throw new Error(`FakeApiClient: unbekannter GET-Pfad ${path}`);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    this.maybeFail();
    if (path === '/profiles') {
      const profile = body as Profile;
      this.profiles = [...this.profiles, profile];
      this.activeId = profile.id;
      this.totalStars[profile.id] = 0;
      return profile as T;
    }
    throw new Error(`FakeApiClient: unbekannter POST-Pfad ${path}`);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    this.maybeFail();
    if (path === '/profiles/active') {
      this.activeId = (body as { id: string }).id;
      return undefined as T;
    }
    const profileId = path.match(/^\/profiles\/(.+)$/)?.[1];
    if (profileId) {
      this.profiles = this.profiles.map((p) => (p.id === profileId ? { ...(body as Profile), id: profileId } : p));
      return undefined as T;
    }
    const progressId = path.match(/^\/progress\/(.+)$/)?.[1];
    if (progressId) {
      const data = body as ProgressData;
      this.progress.set(progressId, data);
      this.totalStars[progressId] = data.totalStars;
      return undefined as T;
    }
    throw new Error(`FakeApiClient: unbekannter PUT-Pfad ${path}`);
  }

  async delete<T>(path: string): Promise<T> {
    this.maybeFail();
    const profileId = path.match(/^\/profiles\/(.+)$/)?.[1];
    if (profileId) {
      this.profiles = this.profiles.filter((p) => p.id !== profileId);
      this.progress.delete(profileId);
      delete this.totalStars[profileId];
      if (this.activeId === profileId) this.activeId = this.profiles[0]?.id ?? null;
      return undefined as T;
    }
    throw new Error(`FakeApiClient: unbekannter DELETE-Pfad ${path}`);
  }

  private maybeFail(): void {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Netzwerkfehler (simuliert)');
    }
  }
}
