import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Profile, ProfileStore } from '../progress/profile-store';
import { ApiClient } from './api-client';
import { DataApi } from './data-api';
import { GUEST_KEY, TOKEN_KEY, TOKEN_STORAGE } from './token-storage';

export interface AuthUser {
  readonly id: number;
  readonly email: string;
}

interface AuthResponse {
  readonly token: string;
  readonly user: AuthUser;
}

/** Muss mit `MIN_PASSWORD_LENGTH` in server/src/auth/routes.ts übereinstimmen. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Kontoverwaltung (E-Mail/Passwort) und Gast-Modus. Räumt bei jeder 401-Antwort automatisch ab (Token
 * abgelaufen oder ungültig) und lädt nach Anmeldung/Wiedereinstieg einmalig die Profile des Kontos.
 * Als Gast landen Profile und Fortschritt nur im Browser; nach Anmeldung oder Registrierung kann
 * die Login-Seite sie auf Wunsch ins Konto übernehmen (`importGuestProfiles`).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly storage = inject(TOKEN_STORAGE);
  private readonly profiles = inject(ProfileStore);
  private readonly data = inject(DataApi);

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _ready = signal(false);
  private readonly _busy = signal(false);
  private bootstrap: Promise<void> | null = null;
  /** Zuletzt gesehener Stand von `api.unauthorized` – damit meldet nur ein NEUER 401 ab, nicht jeder spätere Login. */
  private lastUnauthorized = 0;

  readonly user = this._user.asReadonly();
  readonly isAuthed = computed(() => this._user() !== null);
  readonly isGuest = this.data.guest.asReadonly();
  /** Angemeldet oder als Gast unterwegs – die App ist benutzbar. */
  readonly hasSession = computed(() => this.isAuthed() || this.isGuest());
  readonly ready = this._ready.asReadonly();
  readonly busy = this._busy.asReadonly();

  constructor() {
    // Server sagt „abgemeldet" (401, z. B. abgelaufenes Token) → Konto lokal ebenfalls sofort verlassen.
    // `unauthorized` zählt nur hoch und wird nie zurückgesetzt – ohne den Vergleich mit `lastUnauthorized`
    // würde ein einziger 401 (z. B. ein abgelaufenes Token beim App-Start) jede SPÄTERE erfolgreiche
    // Anmeldung sofort wieder rückgängig machen, sobald `_user` sich ändert.
    effect(() => {
      const count = this.api.unauthorized();
      const isNew = count > this.lastUnauthorized;
      this.lastUnauthorized = count;
      if (isNew && this._user() !== null) this.logout();
    });
  }

  /** Einmal beim App-Start aufrufen (siehe `authReady`-Guard): prüft ein vorhandenes Token. */
  whenReady(): Promise<void> {
    return (this.bootstrap ??= this.bootstrapOnce());
  }

  private async bootstrapOnce(): Promise<void> {
    if (this.readToken()) {
      try {
        const res = await this.api.get<{ user: AuthUser; token?: string }>('/auth/me');
        if (res.token) this.writeToken(res.token);
        this._user.set(res.user);
        await this.profiles.hydrate();
      } catch {
        this.clearToken();
      }
    } else if (this.readItem(GUEST_KEY)) {
      this.data.guest.set(true);
      await this.profiles.hydrate();
    }
    this._ready.set(true);
  }

  async register(email: string, password: string): Promise<void> {
    await this.authenticate('/auth/register', email, password);
  }

  async login(email: string, password: string): Promise<void> {
    await this.authenticate('/auth/login', email, password);
  }

  /** Ohne Konto weiter: Profile und Fortschritt bleiben nur in diesem Browser. */
  async continueAsGuest(): Promise<void> {
    this.writeItem(GUEST_KEY, '1');
    this.data.guest.set(true);
    this.profiles.clear();
    await this.profiles.hydrate();
  }

  /** Meldet vom Konto ab bzw. beendet den Gast-Modus (die Gast-Daten bleiben im Browser liegen). */
  logout(): void {
    this.clearToken();
    this.leaveGuestMode();
    this._user.set(null);
    this.profiles.clear();
  }

  /** Profile, die als Gast nur in diesem Browser gespeichert wurden. */
  guestProfiles(): readonly Profile[] {
    return this.data.local.snapshot().profiles;
  }

  /**
   * Übernimmt die Gast-Profile samt Fortschritt ins angemeldete Konto. Jedes Profil verschwindet erst
   * nach erfolgreichem Hochladen aus dem Browser – bricht die Verbindung ab, entstehen beim erneuten
   * Versuch keine doppelten Profile.
   */
  async importGuestProfiles(): Promise<void> {
    if (!this.isAuthed()) return;
    this._busy.set(true);
    try {
      const local = this.data.local;
      const { activeId } = local.snapshot();
      let newActiveId: string | null = null;
      for (const { id, ...draft } of local.snapshot().profiles) {
        const created = await this.api.post<Profile>('/profiles', draft); // ohne ID: der Server vergibt eine neue
        const progress = local.snapshot().progress[id];
        if (progress) await this.api.put(`/progress/${created.id}`, progress);
        await local.delete(`/profiles/${id}`);
        if (id === activeId) newActiveId = created.id;
      }
      if (newActiveId) await this.api.put('/profiles/active', { id: newActiveId });
      await this.profiles.hydrate();
    } finally {
      this._busy.set(false);
    }
  }

  /** Gast-Profile endgültig aus dem Browser entfernen. */
  discardGuestProfiles(): void {
    this.data.local.clear();
  }

  private async authenticate(path: string, email: string, password: string): Promise<void> {
    this._busy.set(true);
    try {
      const res = await this.api.post<AuthResponse>(path, { email, password });
      this.writeToken(res.token);
      this.leaveGuestMode();
      this._user.set(res.user);
      this.profiles.clear(); // Gast-Profile dürfen nicht stehen bleiben, falls das Laden scheitert
      await this.profiles.hydrate();
    } finally {
      this._busy.set(false);
    }
  }

  private leaveGuestMode(): void {
    this.removeItem(GUEST_KEY);
    this.data.guest.set(false);
  }

  private readToken(): string | null {
    return this.readItem(TOKEN_KEY);
  }

  private writeToken(token: string): void {
    // bei blockierten Website-Daten bleibt die Anmeldung wenigstens für diese Sitzung aktiv
    this.writeItem(TOKEN_KEY, token);
  }

  private clearToken(): void {
    this.removeItem(TOKEN_KEY);
  }

  private readItem(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private writeItem(key: string, value: string): void {
    try {
      this.storage?.setItem(key, value);
    } catch {
      // z. B. blockierte Website-Daten
    }
  }

  private removeItem(key: string): void {
    try {
      this.storage?.removeItem(key);
    } catch {
      // ignorieren
    }
  }
}
