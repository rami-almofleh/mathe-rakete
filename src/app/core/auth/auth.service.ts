import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { ProfileStore } from '../progress/profile-store';
import { ApiClient } from './api-client';
import { TOKEN_KEY, TOKEN_STORAGE } from './token-storage';

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
 * Kontoverwaltung (E-Mail/Passwort). Räumt bei jeder 401-Antwort automatisch ab (Token abgelaufen
 * oder ungültig) und lädt nach Anmeldung/Wiedereinstieg einmalig die Profile des Kontos.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly storage = inject(TOKEN_STORAGE);
  private readonly profiles = inject(ProfileStore);

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _ready = signal(false);
  private readonly _busy = signal(false);
  private bootstrap: Promise<void> | null = null;
  /** Zuletzt gesehener Stand von `api.unauthorized` – damit meldet nur ein NEUER 401 ab, nicht jeder spätere Login. */
  private lastUnauthorized = 0;

  readonly user = this._user.asReadonly();
  readonly isAuthed = computed(() => this._user() !== null);
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
        const res = await this.api.get<{ user: AuthUser }>('/auth/me');
        this._user.set(res.user);
        await this.profiles.hydrate();
      } catch {
        this.clearToken();
      }
    }
    this._ready.set(true);
  }

  async register(email: string, password: string): Promise<void> {
    await this.authenticate('/auth/register', email, password);
  }

  async login(email: string, password: string): Promise<void> {
    await this.authenticate('/auth/login', email, password);
  }

  logout(): void {
    this.clearToken();
    this._user.set(null);
    this.profiles.clear();
  }

  private async authenticate(path: string, email: string, password: string): Promise<void> {
    this._busy.set(true);
    try {
      const res = await this.api.post<AuthResponse>(path, { email, password });
      this.writeToken(res.token);
      this._user.set(res.user);
      await this.profiles.hydrate();
    } finally {
      this._busy.set(false);
    }
  }

  private readToken(): string | null {
    try {
      return this.storage?.getItem(TOKEN_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private writeToken(token: string): void {
    try {
      this.storage?.setItem(TOKEN_KEY, token);
    } catch {
      // z. B. blockierte Website-Daten – Anmeldung bleibt für diese Sitzung trotzdem aktiv
    }
  }

  private clearToken(): void {
    try {
      this.storage?.removeItem(TOKEN_KEY);
    } catch {
      // ignorieren
    }
  }
}
