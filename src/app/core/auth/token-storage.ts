import { InjectionToken } from '@angular/core';

/** Speicher für das Login-Token; in Tests austauschbar. `null` = kein Speicher verfügbar. */
export const TOKEN_STORAGE = new InjectionToken<Storage | null>('TOKEN_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null; // z. B. blockierte Website-Daten
    }
  },
});

export const TOKEN_KEY = 'mathe-rakete.token';

/** Gesetzt, solange jemand ohne Konto als Gast übt (Daten dann nur im Browser, siehe `LocalApiClient`). */
export const GUEST_KEY = 'mathe-rakete.guest';
