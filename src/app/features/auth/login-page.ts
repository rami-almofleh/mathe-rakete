import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../core/auth/api-client';
import { AuthService, MIN_PASSWORD_LENGTH } from '../../core/auth/auth.service';
import { Profile } from '../../core/progress/profile-store';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: `Bitte eine gültige E-Mail-Adresse und ein Passwort mit mindestens ${MIN_PASSWORD_LENGTH} Zeichen eingeben.`,
  email_taken: 'Für diese E-Mail-Adresse gibt es schon ein Konto. Einfach anmelden.',
  invalid_credentials: 'E-Mail-Adresse oder Passwort ist falsch.',
};

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly minPassword = MIN_PASSWORD_LENGTH;
  // `?neu=1` (Link „Konto anlegen“ im Gast-Modus) öffnet direkt die Registrierung
  protected readonly mode = signal<'login' | 'register'>(inject(ActivatedRoute).snapshot.queryParamMap.has('neu') ? 'register' : 'login');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = this.auth.busy;
  /** Nach der Anmeldung gefundene Gast-Profile – erst nachfragen, bevor sie ins Konto wandern. */
  protected readonly guestProfiles = signal<readonly Profile[]>([]);

  protected toggleMode(): void {
    this.mode.set(this.mode() === 'login' ? 'register' : 'login');
    this.error.set(null);
  }

  protected async submit(): Promise<void> {
    const email = this.email().trim();
    const password = this.password();
    if (!email || !password) return;
    this.error.set(null);
    try {
      if (this.mode() === 'register') {
        await this.auth.register(email, password);
      } else {
        await this.auth.login(email, password);
      }
    } catch (err) {
      const code = err instanceof ApiError && err.body && typeof err.body === 'object' ? (err.body as { error?: string }).error : undefined;
      this.error.set((code && ERROR_MESSAGES[code]) ?? 'Das hat leider nicht geklappt. Bitte später noch einmal versuchen.');
      return;
    }
    const guestProfiles = this.auth.guestProfiles();
    if (guestProfiles.length) {
      this.guestProfiles.set(guestProfiles);
    } else {
      void this.router.navigate(['/']);
    }
  }

  protected async continueAsGuest(): Promise<void> {
    await this.auth.continueAsGuest();
    void this.router.navigate(['/']);
  }

  protected async importGuestProfiles(): Promise<void> {
    this.error.set(null);
    try {
      await this.auth.importGuestProfiles();
      void this.router.navigate(['/']);
    } catch {
      // bereits übernommene Profile sind aus dem Browser verschwunden – ein erneuter Versuch macht nur den Rest
      this.guestProfiles.set(this.auth.guestProfiles());
      this.error.set('Das Übernehmen hat nicht ganz geklappt. Bitte noch einmal versuchen.');
    }
  }

  /** Nicht übernehmen: Gast-Profile bleiben im Browser (für den Gast-Modus) – oder werden auf Wunsch gelöscht. */
  protected skipImport(discard: boolean): void {
    if (discard) {
      if (!confirm('Die Profile im Browser mit allen Sternen und Abzeichen wirklich löschen?')) return;
      this.auth.discardGuestProfiles();
    }
    void this.router.navigate(['/']);
  }
}
