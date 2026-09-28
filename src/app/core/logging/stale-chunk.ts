import { inject } from '@angular/core';
import { NavigationError } from '@angular/router';
import { ClientLogger } from './client-logger';

const RELOAD_KEY = 'mathe-rakete.chunk-reload';

/** Fehlermeldungen der Browser, wenn ein nachgeladener Teil der App (chunk-*.js) nicht mehr existiert. */
export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Loading chunk|MIME type/i.test(message);
}

/**
 * Nach einem Update auf dem Server haben die nachgeladenen Dateien neue Namen. Ein Tab, der vorher
 * offen war, findet die alten nicht mehr → einmal neu laden (höchstens alle 30 s, keine Schleife).
 */
export function reloadOnStaleChunk(event: NavigationError): void {
  if (!isStaleChunkError(event.error)) return;
  inject(ClientLogger).report('chunk-reload', String((event.error as Error)?.message ?? event.error), { context: { target: event.url } });
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // ohne sessionStorage trotzdem neu laden
  }
  location.assign(event.url);
}
