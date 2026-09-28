import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
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
          }
          <a class="btn btn-sm btn-outline-primary nav-stars" routerLink="/fortschritt" aria-label="Mein Fortschritt">
            <i class="bi bi-star-fill text-warning" aria-hidden="true"></i>
            <span>{{ progress.data().totalStars }}</span>
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
        </div>
      </div>
    </nav>

    <main class="container py-4">
      <router-outlet />
    </main>
  `,
})
export class App {
  protected readonly progress = inject(ProgressStore);
  protected readonly profiles = inject(ProfileStore);
}
