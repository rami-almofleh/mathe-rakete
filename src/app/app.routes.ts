import { inject, Injector } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { ProfileStore } from './core/progress/profile-store';

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

/** Ohne gewähltes Profil zuerst „Wer übt heute?“ */
const needsProfile = () => inject(ProfileStore).active() !== null || inject(Router).createUrlTree(['/profil']);

/**
 * Hat das Kind schon eine Klasse (im Profil gespeichert), geht es bei jedem Öffnen direkt dorthin.
 * Die Klassen-Übersicht bleibt über den Klassen-Chip in der Navigation (`/klassen`) erreichbar.
 */
const goToOwnGrade = () => {
  const grade = inject(ProfileStore).active()?.grade;
  return grade ? inject(Router).createUrlTree(['/klasse', grade]) : true;
};

/** Ohne laufende Runde (z. B. nach Neuladen) zurück zur Startseite. */
const hasRunningQuiz = () => withSession((s) => s.settings() !== null && s.phase() !== 'finished');
const hasResult = () => withSession((s) => s.phase() === 'finished');

/** `/wiederholen`: Wiederholungsrunde mit den gemerkten Fehlern starten und ins Quiz springen. */
const startReview = async () => {
  const injector = inject(Injector);
  const router = inject(Router);
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
    path: 'profil',
    title: 'Wer übt heute? – Mathe-Rakete',
    loadComponent: () => import('./features/profile/profile-page').then((m) => m.ProfilePage),
  },
  {
    path: '',
    title: 'Mathe-Rakete',
    canActivate: [needsProfile, goToOwnGrade],
    loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
  },
  {
    // Klassen-Übersicht, auch wenn im Profil schon eine Klasse gespeichert ist – erreichbar über den Klassen-Chip in der Navigation
    path: 'klassen',
    title: 'Klasse wählen – Mathe-Rakete',
    canActivate: [needsProfile],
    loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
  },
  {
    path: 'klasse/:grade',
    title: 'Einstellungen – Mathe-Rakete',
    canActivate: [needsProfile],
    loadComponent: () => import('./features/setup/setup-page').then((m) => m.SetupPage),
  },
  {
    path: 'quiz',
    title: 'Quiz – Mathe-Rakete',
    canActivate: [needsProfile, hasRunningQuiz],
    loadComponent: () => import('./features/quiz/quiz-page').then((m) => m.QuizPage),
  },
  {
    path: 'ergebnis',
    title: 'Ergebnis – Mathe-Rakete',
    canActivate: [needsProfile, hasResult],
    loadComponent: () => import('./features/result/result-page').then((m) => m.ResultPage),
  },
  {
    path: 'fortschritt',
    title: 'Fortschritt – Mathe-Rakete',
    canActivate: [needsProfile],
    loadComponent: () => import('./features/progress/progress-page').then((m) => m.ProgressPage),
  },
  { path: 'wiederholen', canActivate: [needsProfile, startReview], children: [] },
  { path: '**', redirectTo: '' },
];
