import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { PreloadAllModules, provideRouter, withComponentInputBinding, withNavigationErrorHandler, withPreloading } from '@angular/router';
import { routes } from './app.routes';
import { ReportingErrorHandler } from './core/logging/client-logger';
import { reloadOnStaleChunk } from './core/logging/stale-chunk';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: ReportingErrorHandler },
    // Alle Seiten nach dem Start im Hintergrund vorladen: Der Wechsel zur Ergebnis-Seite am Rundenende
    // darf nicht vom Netz abhängen (auf dem iPad hing genau dieser Nachlade-Schritt bei schlechter Verbindung).
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules), withNavigationErrorHandler(reloadOnStaleChunk)),
  ],
};
