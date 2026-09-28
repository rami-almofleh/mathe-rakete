import { computed, inject, Injectable, signal } from '@angular/core';
import { Grade, isGrade } from '../models';
import { ApiClient } from '../auth/api-client';

export const PROFILE_ICONS = [
  'bi-rocket-takeoff-fill', 'bi-star-fill', 'bi-heart-fill', 'bi-lightning-charge-fill',
  'bi-flower1', 'bi-emoji-sunglasses-fill', 'bi-bug-fill', 'bi-balloon-fill',
  'bi-moon-stars-fill', 'bi-tree-fill', 'bi-controller', 'bi-music-note-beamed',
] as const;

export const PROFILE_COLORS = ['primary', 'sun', 'mint', 'sky', 'coral'] as const;
export type ProfileColor = (typeof PROFILE_COLORS)[number];

export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly color: ProfileColor;
  readonly grade: Grade | null;
  /** Bundesland (Phase 12); `de` = Deutschland allgemein */
  readonly state: string;
}

export type ProfileDraft = Omit<Profile, 'id'>;

interface ProfilesData {
  readonly profiles: readonly Profile[];
  readonly activeId: string | null;
}

interface ProfilesResponse {
  readonly profiles: readonly Profile[];
  readonly activeId: string | null;
  readonly totalStars: Readonly<Record<string, number>>;
}

export const MAX_NAME_LENGTH = 20;

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

/** Prüft/säubert eine ProfilesResponse vom Server, genau wie früher gespeicherte Browser-Daten. */
export function sanitizeProfile(p: Partial<Profile> & { id: string }): Profile {
  return {
    id: p.id,
    name: typeof p.name === 'string' ? p.name.slice(0, MAX_NAME_LENGTH) : '',
    icon: PROFILE_ICONS.includes(p.icon as (typeof PROFILE_ICONS)[number]) ? p.icon! : PROFILE_ICONS[0],
    color: PROFILE_COLORS.includes(p.color as ProfileColor) ? (p.color as ProfileColor) : 'primary',
    grade: isGrade(p.grade) ? p.grade : null,
    state: typeof p.state === 'string' ? p.state : 'de',
  };
}

/**
 * Kinder-Profile des angemeldeten Kontos. Lokal-zuerst: jede Änderung wirkt sofort auf die
 * Signale (damit die Oberfläche wie gewohnt sofort reagiert) und wird zusätzlich im Hintergrund
 * zum Server geschickt (`void this.api...().catch(...)`, nicht abgewartet). `hydrate()` holt den
 * Stand vom Server – einmal nach dem Anmelden, aufgerufen von `AuthService`.
 */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly api = inject(ApiClient);

  private readonly _data = signal<ProfilesData>({ profiles: [], activeId: null });
  private readonly _totalStars = signal<Readonly<Record<string, number>>>({});
  private readonly _loading = signal(false);

  readonly profiles = computed(() => this._data().profiles);
  readonly activeId = computed(() => this._data().activeId);
  readonly active = computed(() => this.profiles().find((p) => p.id === this.activeId()) ?? null);
  readonly loading = this._loading.asReadonly();

  /** Vom Server holen (nach Login, oder erneut versuchen, falls der erste Versuch fehlschlug). */
  async hydrate(): Promise<void> {
    this._loading.set(true);
    try {
      const res = await this.api.get<ProfilesResponse>('/profiles');
      const profiles = res.profiles.map(sanitizeProfile);
      const activeId = profiles.some((p) => p.id === res.activeId) ? res.activeId : null;
      this._data.set({ profiles, activeId });
      this._totalStars.set(res.totalStars);
    } catch {
      // Verbindung/Server nicht erreichbar – vorherigen Stand (falls vorhanden) einfach behalten
    } finally {
      this._loading.set(false);
    }
  }

  /** Beim Abmelden: nichts vom vorigen Konto darf für das nächste sichtbar bleiben. */
  clear(): void {
    this._data.set({ profiles: [], activeId: null });
    this._totalStars.set({});
  }

  totalStarsOf(profileId: string): number {
    return this._totalStars()[profileId] ?? 0;
  }

  /** Von `ProgressStore` nach jeder Runde aufgerufen, damit die Profilkarten sofort mitziehen. */
  setTotalStars(profileId: string, value: number): void {
    this._totalStars.update((m) => ({ ...m, [profileId]: value }));
  }

  create(draft: ProfileDraft): Profile {
    const profile: Profile = { ...draft, name: draft.name.trim().slice(0, MAX_NAME_LENGTH), id: newId() };
    this._data.update((d) => ({ profiles: [...d.profiles, profile], activeId: profile.id }));
    this._totalStars.update((m) => ({ ...m, [profile.id]: 0 }));
    void this.api.post('/profiles', profile).catch(() => {
      // Bestenfalls beim nächsten hydrate() wieder synchron – für ein einzelnes Familien-Gerät
      // ist ein verlorener Schreibversuch unwahrscheinlich und nicht kritisch.
    });
    return profile;
  }

  update(id: string, draft: ProfileDraft): void {
    const name = draft.name.trim().slice(0, MAX_NAME_LENGTH);
    this._data.update((d) => ({ ...d, profiles: d.profiles.map((p) => (p.id === id ? { ...draft, id, name } : p)) }));
    void this.api.put(`/profiles/${id}`, { ...draft, name }).catch(() => {});
  }

  remove(id: string): void {
    this._data.update((d) => {
      const profiles = d.profiles.filter((p) => p.id !== id);
      const activeId = d.activeId === id ? (profiles[0]?.id ?? null) : d.activeId;
      return { profiles, activeId };
    });
    void this.api.delete(`/profiles/${id}`).catch(() => {});
  }

  select(id: string): void {
    if (!this.profiles().some((p) => p.id === id)) return;
    this._data.update((d) => ({ ...d, activeId: id }));
    void this.api.put('/profiles/active', { id }).catch(() => {});
  }
}
