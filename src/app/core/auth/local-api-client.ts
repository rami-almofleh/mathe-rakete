import type { Profile } from '../progress/profile-store';
import type { ProgressData } from '../progress/progress-store';

/** Alles, was ein Gast im Browser speichert – dieselbe Form, die der Server je Konto hält. */
export interface LocalData {
  readonly profiles: readonly Profile[];
  readonly activeId: string | null;
  readonly progress: Readonly<Record<string, ProgressData>>;
}

export const GUEST_DATA_KEY = 'mathe-rakete.guest-data';

const EMPTY: LocalData = { profiles: [], activeId: null, progress: {} };

/**
 * Bildet dieselben Endpunkte wie `server/src/profiles/routes.ts` und `server/src/progress/routes.ts`
 * nach, speichert aber nur im Browser (Gast-Modus). Ohne `storage` bleibt alles im Speicher (Tests).
 */
export class LocalApiClient {
  private memory: LocalData = EMPTY;

  constructor(private readonly storage: Storage | null) {}

  /** Gesamter Stand, z. B. um ihn nach der Registrierung ins Konto zu übernehmen. */
  snapshot(): LocalData {
    if (!this.storage) return this.memory;
    try {
      const raw = JSON.parse(this.storage.getItem(GUEST_DATA_KEY) ?? 'null') as Partial<LocalData> | null;
      return {
        profiles: Array.isArray(raw?.profiles) ? raw.profiles.filter((p) => p && typeof p.id === 'string') : [],
        activeId: typeof raw?.activeId === 'string' ? raw.activeId : null,
        progress: raw?.progress && typeof raw.progress === 'object' ? raw.progress : {},
      };
    } catch {
      return this.memory;
    }
  }

  clear(): void {
    this.write(EMPTY);
  }

  async get<T>(path: string): Promise<T> {
    const data = this.snapshot();
    if (path === '/profiles') {
      const totalStars = Object.fromEntries(data.profiles.map((p) => [p.id, data.progress[p.id]?.totalStars ?? 0]));
      return { profiles: data.profiles, activeId: data.activeId, totalStars } as T;
    }
    const progressId = path.match(/^\/progress\/(.+)$/)?.[1];
    if (progressId) {
      return (data.progress[progressId] ?? null) as T;
    }
    throw new Error(`LocalApiClient: unbekannter GET-Pfad ${path}`);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    if (path === '/profiles') {
      // wie der Server: ohne mitgeschickte ID wird eine erzeugt
      const draft = body as Profile;
      const profile: Profile = { ...draft, id: draft.id || crypto.randomUUID() };
      const data = this.snapshot();
      this.write({ ...data, profiles: [...data.profiles, profile], activeId: profile.id });
      return profile as T;
    }
    throw new Error(`LocalApiClient: unbekannter POST-Pfad ${path}`);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const data = this.snapshot();
    if (path === '/profiles/active') {
      this.write({ ...data, activeId: (body as { id: string | null }).id });
      return undefined as T;
    }
    const profileId = path.match(/^\/profiles\/(.+)$/)?.[1];
    if (profileId) {
      this.write({ ...data, profiles: data.profiles.map((p) => (p.id === profileId ? { ...(body as Profile), id: profileId } : p)) });
      return undefined as T;
    }
    const progressId = path.match(/^\/progress\/(.+)$/)?.[1];
    if (progressId) {
      this.write({ ...data, progress: { ...data.progress, [progressId]: body as ProgressData } });
      return undefined as T;
    }
    throw new Error(`LocalApiClient: unbekannter PUT-Pfad ${path}`);
  }

  async delete<T>(path: string): Promise<T> {
    const profileId = path.match(/^\/profiles\/(.+)$/)?.[1];
    if (profileId) {
      const data = this.snapshot();
      const profiles = data.profiles.filter((p) => p.id !== profileId);
      const { [profileId]: _removed, ...progress } = data.progress;
      const activeId = data.activeId === profileId ? (profiles[0]?.id ?? null) : data.activeId;
      this.write({ profiles, activeId, progress });
      return undefined as T;
    }
    throw new Error(`LocalApiClient: unbekannter DELETE-Pfad ${path}`);
  }

  private write(data: LocalData): void {
    this.memory = data;
    if (!this.storage) return;
    try {
      if (data.profiles.length) {
        this.storage.setItem(GUEST_DATA_KEY, JSON.stringify(data));
      } else {
        this.storage.removeItem(GUEST_DATA_KEY);
      }
    } catch {
      // z. B. Speicher voll oder blockiert – der Stand bleibt wenigstens für diese Sitzung erhalten
    }
  }
}
