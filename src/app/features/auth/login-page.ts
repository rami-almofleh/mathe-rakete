import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from '../../core/auth/api-client';
import { AuthService, MIN_PASSWORD_LENGTH } from '../../core/auth/auth.service';

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
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly minPassword = MIN_PASSWORD_LENGTH;
  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = this.auth.busy;

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
      void this.router.navigate(['/']);
    } catch (err) {
      const code = err instanceof ApiError && err.body && typeof err.body === 'object' ? (err.body as { error?: string }).error : undefined;
      this.error.set((code && ERROR_MESSAGES[code]) ?? 'Das hat leider nicht geklappt. Bitte später noch einmal versuchen.');
    }
  }
}
