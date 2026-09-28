import { InjectionToken } from '@angular/core';

/** Speicher für Profile und Fortschritt; in Tests austauschbar. `null` = kein Speicher verfügbar. */
export const PROGRESS_STORAGE = new InjectionToken<Storage | null>('PROGRESS_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null; // z. B. blockierte Website-Daten
    }
  },
});
