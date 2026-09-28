import { Component, computed, effect, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { SoundService } from '../../core/progress/sound';
import { QuizSession } from '../../core/quiz/quiz-session';
import { FigureView } from '../../shared/figure/figure-view';
import { MathView } from '../../shared/math-view/math-view';

const PRAISE = ['Super!', 'Richtig!', 'Klasse!', 'Toll gemacht!', 'Spitze!', 'Genau so!', 'Stark!'];
/** Nach einer richtigen Antwort geht es automatisch weiter. */
const AUTO_NEXT_MS = 1100;

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
  private readonly nextButton = viewChild<ElementRef<HTMLButtonElement>>('nextButton');

  protected readonly task = this.session.task;
  protected readonly phase = this.session.phase;
  protected readonly lastRecord = this.session.lastRecord;
  protected readonly praise = signal(PRAISE[0]);
  /** Sterne, die bei einer richtigen Antwort aus dem Knopf fliegen */
  protected readonly burst = [0, 1, 2, 3, 4, 5, 6, 7];

  protected readonly isRound = computed(() => this.session.settings()?.timer.mode === 'perRound');
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
      if (this.phase() === 'finished') {
        void this.router.navigate(['/ergebnis']);
      }
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
    const grade = this.session.settings()?.grade;
    this.session.abandon();
    void this.router.navigate(grade ? ['/klasse', grade] : ['/']);
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
    // Seite verlassen (z. B. Zurück-Taste) → Timer stoppen; ein fertiges Ergebnis bleibt erhalten
    if (this.phase() !== 'finished') {
      this.session.abandon();
    }
  }
}
