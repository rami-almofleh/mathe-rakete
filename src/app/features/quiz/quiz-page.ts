import { Component, computed, effect, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { ClientLogger } from '../../core/logging/client-logger';
import { LESSON_STEPS } from '../../core/models';
import { Router } from '@angular/router';
import { SoundService } from '../../core/progress/sound';
import { QuizSession } from '../../core/quiz/quiz-session';
import { FigureView } from '../../shared/figure/figure-view';
import { MathView } from '../../shared/math-view/math-view';

const PRAISE = ['Super!', 'Richtig!', 'Klasse!', 'Toll gemacht!', 'Spitze!', 'Genau so!', 'Stark!'];
/** Nach einer richtigen Antwort geht es automatisch weiter. */
const AUTO_NEXT_MS = 1100;
/** Wie oft der Quiz-Wächter prüft und ab wann etwas als „hängt“ gilt */
const WATCHDOG_MS = 1000;
const STUCK_MS = 3000;

type ChoiceState = 'open' | 'correct' | 'wrong' | 'dimmed';

@Component({
  selector: 'app-quiz-page',
  imports: [MathView, FigureView],
  templateUrl: './quiz-page.html',
  styleUrl: './quiz-page.scss',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class QuizPage implements OnDestroy {
  protected readonly session = inject(QuizSession);
  private readonly router = inject(Router);
  private readonly sound = inject(SoundService);
  private readonly logger = inject(ClientLogger);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly nextButton = viewChild<ElementRef<HTMLButtonElement>>('nextButton');

  protected readonly task = this.session.task;
  protected readonly phase = this.session.phase;
  protected readonly lastRecord = this.session.lastRecord;
  protected readonly praise = signal(PRAISE[0]);
  /** Sterne, die bei einer richtigen Antwort aus dem Knopf fliegen */
  protected readonly burst = [0, 1, 2, 3, 4, 5, 6, 7];

  protected readonly isRound = computed(() => this.session.settings()?.timer.mode === 'perRound');
  protected readonly isTest = computed(() => this.session.settings()?.lesson?.step === 'test');
  /** „Level 2“ bzw. „Test“ in Lektions-Runden */
  protected readonly stepLabel = computed(() => {
    const step = this.session.settings()?.lesson?.step;
    return step ? LESSON_STEPS.find((s) => s.id === step)?.label : undefined;
  });
  protected readonly taskNumber = computed(() => this.session.records().length + (this.phase() === 'question' ? 1 : 0));
  protected readonly taskCount = computed(() => this.session.settings()?.taskCount ?? 0);
  protected readonly progressPercent = computed(() =>
    this.isRound() ? 0 : (this.session.records().length / Math.max(1, this.taskCount())) * 100,
  );

  /** Lange Antworten (Terme, Formeln, Vektoren) untereinander statt nebeneinander – sonst würden sie abgeschnitten. */
  protected readonly wideChoices = computed(() =>
    (this.task()?.choices ?? []).some((c) => c.display.value.length > (c.display.kind === 'tex' ? 18 : 14) || c.display.value.includes('pmatrix')),
  );

  protected readonly remainingSeconds = computed(() => Math.ceil((this.session.remainingMs() ?? 0) / 1000));
  protected readonly timeLow = computed(() => {
    const ms = this.session.remainingMs();
    return ms !== null && ms <= (this.isRound() ? 10_000 : 3_000);
  });

  constructor() {
    effect(() => {
      if (this.phase() === 'finished') this.goToResult();
    });

    effect((onCleanup) => {
      const record = this.lastRecord();
      if (this.phase() !== 'feedback' || !record) return;
      this.sound.play(record.correct ? 'correct' : 'wrong');
      if (record.correct) {
        this.praise.set(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
        const timeout = setTimeout(() => this.session.next(), AUTO_NEXT_MS);
        onCleanup(() => clearTimeout(timeout));
      }
    });

    // Bei falscher Antwort den „Weiter“-Knopf fokussieren (Tastatur & Screenreader)
    effect(() => this.nextButton()?.nativeElement.focus());
  }

  // ---- Quiz-Wächter: erkennt Hänger, meldet sie an den Server (pm2 logs) und repariert, was geht ----
  private readonly watchdog = setInterval(() => this.checkStuck(), WATCHDOG_MS);
  private watch = { key: '', since: 0, remaining: null as number | null, remainingSince: 0 };

  private checkStuck(): void {
    if (typeof document !== 'undefined' && document.hidden) return; // Hintergrund-Tabs drosselt der Browser
    const now = Date.now();
    const phase = this.phase();
    // Phase allein reicht nicht: Zwei schnelle richtige Antworten hintereinander sähen bei sekündlicher
    // Prüfung wie eine einzige, lange Rückmeldung aus (Fehlalarm). Mit der Anzahl beantworteter
    // Aufgaben ist jede Rückmeldung und jede Frage ein eigener Zustand.
    const key = `${phase}:${this.session.records().length}`;
    if (key !== this.watch.key) {
      this.watch = { ...this.watch, key, since: now, remaining: null, remainingSince: now };
    }
    const record = this.lastRecord();
    const context = () => ({
      phase,
      task: this.task()?.topicId,
      prompt: this.task()?.prompt.math.value.slice(0, 60),
      done: this.session.records().length,
      remainingMs: this.session.remainingMs(),
      timer: this.session.settings()?.timer,
      stuckForMs: now - this.watch.since,
    });

    // 1) Richtig geantwortet, aber das automatische Weiter kam nicht
    if (phase === 'feedback' && record?.correct && now - this.watch.since > AUTO_NEXT_MS + STUCK_MS) {
      this.logger.report('stuck', 'Nach richtiger Antwort ging es nicht automatisch weiter', { context: context() });
      this.watch.since = now;
      this.session.next();
      return;
    }

    // 2) Runde ist fertig, aber der Wechsel zur Ergebnis-Seite kam nicht an (z. B. Netz hing) → erneut versuchen
    if (phase === 'finished' && now - this.watch.since > STUCK_MS) {
      this.logger.report('stuck', 'Runde fertig, aber die Ergebnis-Seite öffnete sich nicht', { context: context() });
      this.watch.since = now;
      this.goToResult();
      return;
    }

    if (phase !== 'question') return;

    // 3) Offene Frage mit Timer, aber die Zeit läuft nicht mehr
    const timer = this.session.settings()?.timer;
    if (timer && timer.mode !== 'off') {
      const remaining = this.session.remainingMs();
      if (remaining !== this.watch.remaining) {
        this.watch.remaining = remaining;
        this.watch.remainingSince = now;
      } else if ((remaining ?? 0) > 0 && now - this.watch.remainingSince > STUCK_MS) {
        this.logger.report('stuck', 'Timer lief während einer offenen Frage nicht weiter', { context: context() });
        this.watch.remainingSince = now;
        this.session.resumeTimer();
      }
    }

    // 4) Frage offen, aber die angezeigten Kacheln sind noch gesperrt → Anzeige aktualisiert sich nicht mehr
    const disabled = this.host.nativeElement.querySelectorAll('.choice:disabled').length;
    if (disabled > 0 && now - this.watch.since > STUCK_MS) {
      this.logger.report('stuck', 'Antwort-Kacheln gesperrt, obwohl eine Frage offen ist (Anzeige hängt)', {
        context: { ...context(), disabled, shownPrompt: this.host.nativeElement.querySelector('.prompt')?.textContent?.trim().slice(0, 60) },
      });
      this.watch.since = now;
    }
  }

  private goToResult(): void {
    this.logger.breadcrumb('nav:to-result');
    this.router.navigate(['/ergebnis']).then(
      (ok) => {
        if (!ok) this.logger.breadcrumb('nav:to-result-rejected');
      },
      (error: Error) => this.logger.report('error', `Wechsel zur Ergebnis-Seite fehlgeschlagen: ${error.message}`, { stack: error.stack }),
    );
  }

  protected choiceState(index: number): ChoiceState {
    const task = this.task();
    const record = this.lastRecord();
    if (this.phase() !== 'feedback' || !task || !record) return 'open';
    if (index === task.correctIndex) return 'correct';
    if (index === record.chosenIndex) return 'wrong';
    return 'dimmed';
  }

  protected choose(index: number): void {
    this.session.answer(index);
  }

  protected next(): void {
    this.session.next();
  }

  protected quit(): void {
    const settings = this.session.settings();
    this.session.abandon();
    if (settings?.lesson) {
      void this.router.navigate(['/klasse', settings.grade, 'lektion', settings.lesson.topicId]);
    } else if (settings?.mode === 'review') {
      void this.router.navigate(['/klasse', settings.grade]);
    } else {
      void this.router.navigate(settings ? ['/klasse', settings.grade, 'frei'] : ['/']);
    }
  }

  protected onKey(event: KeyboardEvent): void {
    if (this.phase() === 'question' && ['1', '2', '3'].includes(event.key)) {
      event.preventDefault();
      this.choose(Number(event.key) - 1);
    } else if (this.phase() === 'feedback' && event.key === 'Enter') {
      event.preventDefault();
      this.next();
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.watchdog);
    // Seite verlassen (z. B. Zurück-Taste) → Timer stoppen; ein fertiges Ergebnis bleibt erhalten
    if (this.phase() !== 'finished') {
      this.session.abandon();
    }
  }
}
