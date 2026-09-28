import { inject, Injector } from '@angular/core';
import { Router, Routes, UrlTree } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { ProfileStore } from './core/progress/profile-store';
import { ProgressStore } from './core/progress/progress-store';

/**
 * Die Guards laden den Quiz-Service (und damit alle Aufgaben-Generatoren) erst bei Bedarf –
 * so bleibt die Startseite klein und schnell.
 */
const withSession = async (check: (session: import('./core/quiz/quiz-session').QuizSession) => boolean) => {
  const injector = inject(Injector);
  const router = inject(Router);
  const { QuizSession } = await import('./core/quiz/quiz-session');
  return check(injector.get(QuizSession)) || router.createUrlTree(['/']);
};

/**
 * Angular startet alle `canActivate`-Guards einer Route gleichzeitig. Deshalb wartet jeder Guard, der
 * Anmeldung oder Profile braucht, selbst auf die einmalige Token-Prüfung (samt Laden der Profile) –
 * sonst prüft er beim Neuladen einer Unterseite zu früh und leitet fälschlich zum Login um.
 */
const afterAuth = (check: (auth: AuthService, profiles: ProfileStore, router: Router) => boolean | UrlTree) => async () => {
  const auth = inject(AuthService);
  const profiles = inject(ProfileStore);
  const router = inject(Router);
  await auth.whenReady();
  return check(auth, profiles, router);
};

/** Ohne Anmeldung geht es zuerst zum Login. */
const needsAuth = afterAuth((auth, _, router) => auth.isAuthed() || router.createUrlTree(['/login']));

/** Schon angemeldet? Dann hat die Login-Seite nichts mehr zu tun. */
const redirectIfAuthed = afterAuth((auth, _, router) => !auth.isAuthed() || router.createUrlTree(['/']));

/** Ohne gewähltes Profil zuerst „Wer übt heute?” */
const needsProfile = afterAuth((_, profiles, router) => profiles.active() !== null || router.createUrlTree(['/profil']));

/**
 * Hat das Kind schon eine Klasse (im Profil gespeichert), geht es bei jedem Öffnen direkt dorthin.
 * Die Klassen-Übersicht bleibt über den Klassen-Chip in der Navigation (`/klassen`) erreichbar.
 */
const goToOwnGrade = afterAuth((_, profiles, router) => {
  const grade = profiles.active()?.grade;
  return grade ? router.createUrlTree(['/klasse', grade]) : true;
});

/** Ohne laufende Runde (z. B. nach Neuladen) zurück zur Startseite. */
const hasRunningQuiz = () => withSession((s) => s.settings() !== null && s.phase() !== 'finished');
const hasResult = () => withSession((s) => s.phase() === 'finished');

/** `/wiederholen`: Wiederholungsrunde mit den gemerkten Fehlern starten und ins Quiz springen. */
const startReview = async () => {
  const injector = inject(Injector);
  const router = inject(Router);
  const auth = inject(AuthService);
  const progress = inject(ProgressStore);
  // Beim Neuladen direkt auf /wiederholen muss die Fehlerliste erst vom Server kommen
  await auth.whenReady();
  await progress.hydrate();
  const { QuizSession } = await import('./core/quiz/quiz-session');
  try {
    injector.get(QuizSession).startReview();
    return router.createUrlTree(['/quiz']);
  } catch {
    return router.createUrlTree(['/fortschritt']); // nichts zu wiederholen
  }
};

export const routes: Routes = [
  {
    path: 'login',
    title: 'Anmelden – Mathe-Rakete',
    canActivate: [redirectIfAuthed],
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'profil',
    title: 'Wer übt heute? – Mathe-Rakete',
    canActivate: [needsAuth],
    loadComponent: () => import('./features/profile/profile-page').then((m) => m.ProfilePage),
  },
  {
    path: '',
    title: 'Mathe-Rakete',
    canActivate: [needsAuth, needsProfile, goToOwnGrade],
    loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
  },
  {
    // Klassen-Übersicht, auch wenn im Profil schon eine Klasse gespeichert ist – erreichbar über den Klassen-Chip in der Navigation
    path: 'klassen',
    title: 'Klasse wählen – Mathe-Rakete',
    canActivate: [needsAuth, needsProfile],
    loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
  },
  {
    path: 'klasse/:grade',
    title: 'Einstellungen – Mathe-Rakete',
    canActivate: [needsAuth, needsProfile],
    loadComponent: () => import('./features/setup/setup-page').then((m) => m.SetupPage),
  },
  {
    path: 'quiz',
    title: 'Quiz – Mathe-Rakete',
    canActivate: [needsAuth, needsProfile, hasRunningQuiz],
    loadComponent: () => import('./features/quiz/quiz-page').then((m) => m.QuizPage),
  },
  {
    path: 'ergebnis',
    title: 'Ergebnis – Mathe-Rakete',
    canActivate: [needsAuth, needsProfile, hasResult],
    loadComponent: () => import('./features/result/result-page').then((m) => m.ResultPage),
  },
  {
    path: 'fortschritt',
    title: 'Fortschritt – Mathe-Rakete',
    canActivate: [needsAuth, needsProfile],
    loadComponent: () => import('./features/progress/progress-page').then((m) => m.ProgressPage),
  },
  { path: 'wiederholen', canActivate: [needsAuth, needsProfile, startReview], children: [] },
  { path: '**', redirectTo: '' },
];
