import { computed, inject, Injectable, signal } from '@angular/core';
import { Grade, isGrade } from '../models';
import { PROGRESS_STORAGE } from './progress-storage';

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
  readonly version: 1;
  readonly profiles: readonly Profile[];
  readonly activeId: string | null;
}

const PROFILES_KEY = 'mathe-rakete.profiles';
/** Fortschritt vor der Einführung von Profilen */
export const LEGACY_PROGRESS_KEY = 'mathe-rakete.progress';
export const MAX_NAME_LENGTH = 20;

export function progressKey(profileId: string): string {
  return `${LEGACY_PROGRESS_KEY}.${profileId}`;
}

/** Auch für Sicherungsdateien genutzt (backup.ts) – prüft und säubert dieselbe Form. */
export function parseProfiles(raw: string | null): ProfilesData {
  const empty: ProfilesData = { version: 1, profiles: [], activeId: null };
  if (!raw) return empty;
  try {
    const data = JSON.parse(raw) as Partial<ProfilesData>;
    if (data.version !== 1 || !Array.isArray(data.profiles)) return empty;
    const profiles = data.profiles
      .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
      .map((p) => ({
        id: p.id,
        name: p.name.slice(0, MAX_NAME_LENGTH),
        icon: PROFILE_ICONS.includes(p.icon as (typeof PROFILE_ICONS)[number]) ? p.icon : PROFILE_ICONS[0],
        color: PROFILE_COLORS.includes(p.color) ? p.color : 'primary',
        grade: isGrade(p.grade) ? p.grade : null,
        state: typeof p.state === 'string' ? p.state : 'de',
      }));
    const activeId = profiles.some((p) => p.id === data.activeId) ? data.activeId! : null;
    return { version: 1, profiles, activeId };
  } catch {
    return empty;
  }
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

/** Kinder-Profile auf diesem Gerät – jedes Profil hat seinen eigenen Fortschritt. */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly storage = inject(PROGRESS_STORAGE);
  private readonly _data = signal<ProfilesData>(this.load());

  readonly profiles = computed(() => this._data().profiles);
  readonly activeId = computed(() => this._data().activeId);
  readonly active = computed(() => this.profiles().find((p) => p.id === this.activeId()) ?? null);

  create(draft: ProfileDraft): Profile {
    const profile: Profile = { ...draft, name: draft.name.trim().slice(0, MAX_NAME_LENGTH), id: newId() };
    const first = this._data().profiles.length === 0;
    if (first) this.adoptLegacyProgress(profile.id);
    this.save({ ...this._data(), profiles: [...this._data().profiles, profile], activeId: profile.id });
    return profile;
  }

  update(id: string, draft: ProfileDraft): void {
    const profiles = this._data().profiles.map((p) => (p.id === id ? { ...draft, id, name: draft.name.trim().slice(0, MAX_NAME_LENGTH) } : p));
    this.save({ ...this._data(), profiles });
  }

  remove(id: string): void {
    const profiles = this._data().profiles.filter((p) => p.id !== id);
    const activeId = this._data().activeId === id ? (profiles[0]?.id ?? null) : this._data().activeId;
    try {
      this.storage?.removeItem(progressKey(id));
    } catch {
      // egal – ohne Profil wird der Eintrag nie wieder gelesen
    }
    this.save({ ...this._data(), profiles, activeId });
  }

  select(id: string): void {
    if (this._data().profiles.some((p) => p.id === id)) {
      this.save({ ...this._data(), activeId: id });
    }
  }

  /**
   * Ersetzt ALLE Profile (Sicherung einlesen, siehe backup.ts). Der Fortschritt je Profil muss
   * vorher schon im Speicher stehen – `BackupService.restore` schreibt ihn davor.
   */
  replaceAll(profiles: readonly Profile[], activeId: string | null): void {
    const validActive = profiles.some((p) => p.id === activeId) ? activeId : (profiles[0]?.id ?? null);
    this.save({ version: 1, profiles, activeId: validActive });
  }

  /** Den Fortschritt aus der Zeit vor den Profilen übernimmt das erste Profil. */
  private adoptLegacyProgress(profileId: string): void {
    try {
      const legacy = this.storage?.getItem(LEGACY_PROGRESS_KEY);
      if (legacy) {
        this.storage?.setItem(progressKey(profileId), legacy);
        this.storage?.removeItem(LEGACY_PROGRESS_KEY);
      }
    } catch {
      // kein Speicher – nichts zu übernehmen
    }
  }

  private load(): ProfilesData {
    try {
      return parseProfiles(this.storage?.getItem(PROFILES_KEY) ?? null);
    } catch {
      return parseProfiles(null);
    }
  }

  private save(data: ProfilesData): void {
    this._data.set(data);
    try {
      this.storage?.setItem(PROFILES_KEY, JSON.stringify(data));
    } catch {
      // Speicher blockiert – Profile gelten nur für diese Sitzung
    }
  }
}
