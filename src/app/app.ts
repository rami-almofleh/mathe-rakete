import { Component, inject } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterLink, RouterOutlet } from '@angular/router';
import { ClientLogger } from './core/logging/client-logger';
import { AuthService } from './core/auth/auth.service';
import { ProfileStore } from './core/progress/profile-store';
import { ProgressStore } from './core/progress/progress-store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  styleUrl: './app.scss',
  template: `
    <nav class="navbar app-navbar">
      <div class="container">
        <a class="navbar-brand d-flex align-items-center gap-2" routerLink="/">
          <span class="brand-icon"><i class="bi bi-rocket-takeoff-fill" aria-hidden="true"></i></span>
          <span class="display-font">Mathe-Rakete</span>
        </a>
        <div class="d-flex align-items-center gap-2">
          @if (auth.isAuthed()) {
            @if (profiles.active(); as p) {
              <a class="btn btn-sm btn-outline-primary nav-profile color-{{ p.color }}" routerLink="/profil" [attr.aria-label]="'Profil wechseln (' + p.name + ')'">
                <span class="nav-avatar"><i class="bi {{ p.icon }}" aria-hidden="true"></i></span>
                <span class="d-none d-sm-inline text-truncate">{{ p.name }}</span>
              </a>
              @if (p.grade) {
                <a class="btn btn-sm btn-outline-primary nav-grade" routerLink="/klassen" aria-label="Andere Klasse ansehen">
                  <span>Kl. {{ p.grade }}</span>
                  <i class="bi bi-chevron-down" aria-hidden="true"></i>
                </a>
              }
              <a class="btn btn-sm btn-outline-primary nav-stars" routerLink="/fortschritt" aria-label="Mein Fortschritt">
                <i class="bi bi-star-fill text-warning nav-star-icon" aria-hidden="true"></i>
                <!-- neu erzeugt bei jeder Änderung → hüpft, wenn Sterne dazukommen -->
                @for (stars of [progress.data().totalStars]; track stars) {
                  <span class="ml-bump">{{ stars }}</span>
                }
              </a>
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary nav-sound"
                [attr.aria-pressed]="progress.sound()"
                [attr.aria-label]="progress.sound() ? 'Töne ausschalten' : 'Töne einschalten'"
                (click)="progress.setSound(!progress.sound())"
              >
                <i class="bi" [class.bi-volume-up-fill]="progress.sound()" [class.bi-volume-mute-fill]="!progress.sound()" aria-hidden="true"></i>
              </button>
            }
            <button type="button" class="btn btn-sm btn-outline-secondary nav-logout" aria-label="Abmelden" (click)="logout()">
              <i class="bi bi-box-arrow-right" aria-hidden="true"></i>
              <span class="d-none d-sm-inline">Abmelden</span>
            </button>
          } @else {
            <a class="btn btn-sm btn-primary nav-login" routerLink="/login">Anmelden</a>
          }
        </div>
      </div>
    </nav>

    <main class="container py-4">
      <router-outlet />
    </main>
  `,
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly progress = inject(ProgressStore);
  protected readonly profiles = inject(ProfileStore);
  private readonly router = inject(Router);
  private readonly logger = inject(ClientLogger);

  constructor() {
    // Jeder Seitenwechsel als Brotkrume; Fehler und hängende Wechsel werden an den Server gemeldet
    let pendingTimer: ReturnType<typeof setTimeout> | undefined;
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.logger.breadcrumb('nav:start', { url: event.url });
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(
          () => this.logger.report('stuck', `Seitenwechsel nach ${event.url} hängt seit 8 s`, { context: { from: location.pathname, online: navigator.onLine } }),
          8000,
        );
      } else if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
        clearTimeout(pendingTimer);
        if (event instanceof NavigationEnd) this.logger.breadcrumb('nav:end', { url: event.urlAfterRedirects });
        if (event instanceof NavigationCancel) this.logger.breadcrumb('nav:cancel', { url: event.url, reason: event.reason });
        if (event instanceof NavigationError) {
          const err = event.error as Error;
          this.logger.report('error', `Seitenwechsel nach ${event.url} fehlgeschlagen: ${err?.message ?? err}`, { stack: err?.stack });
        }
      }
    });
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
