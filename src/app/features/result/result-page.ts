import { Component, computed, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { findTopic } from '../../core/curriculum/curriculum';
import { LessonStep } from '../../core/models';
import { followingStep, stepLabel } from '../../core/progress/lesson';
import { ProfileStore } from '../../core/progress/profile-store';
import { ProgressStore } from '../../core/progress/progress-store';
import { SoundService } from '../../core/progress/sound';
import { formatDuration } from '../../core/quiz/quiz-config';
import { lessonSettings } from '../../core/quiz/topic-pool';
import { QuizSession } from '../../core/quiz/quiz-session';
import { Confetti } from '../../shared/confetti/confetti';
import { FigureView } from '../../shared/figure/figure-view';
import { MathView } from '../../shared/math-view/math-view';

const HEADLINES = ['Weiter üben – du schaffst das!', 'Gut gemacht!', 'Sehr gut!', 'Hervorragend!'] as const;

@Component({
  selector: 'app-result-page',
  imports: [RouterLink, MathView, Confetti, FigureView],
  templateUrl: './result-page.html',
  styleUrl: './result-page.scss',
})
export class ResultPage implements OnInit {
  private readonly session = inject(QuizSession);
  private readonly router = inject(Router);
  private readonly sound = inject(SoundService);

  protected readonly summary = this.session.summary;
  protected readonly settings = this.session.settings;
  protected readonly starSlots = [1, 2, 3];

  protected readonly headline = computed(() => HEADLINES[this.summary().stars]);
  protected readonly accuracyPercent = computed(() => Math.round(this.summary().accuracy * 100));
  protected readonly duration = computed(() => formatDuration(this.summary().durationMs));
  protected readonly isRound = computed(() => this.settings()?.timer.mode === 'perRound');
  protected readonly newBadges = this.session.newBadges;
  protected readonly isReview = computed(() => this.settings()?.mode === 'review');
  /** Gemerkte Fehler (auch aus früheren Runden) */
  protected readonly toReview = inject(ProgressStore).mistakes;
  protected readonly celebrate = computed(() => this.summary().stars >= 2 || this.newBadges().length > 0);

  /** Lektions-Runde: „Level 2 geschafft · Plus bis 1 000“ */
  protected readonly lessonLine = computed(() => {
    const lesson = this.settings()?.lesson;
    if (!lesson) return null;
    const passed = this.summary().stars >= 1 ? ' geschafft' : '';
    return `${stepLabel(lesson.step)}${passed} · ${this.topicTitle(lesson.topicId)}`;
  });
  /** Weiter zum nächsten Schritt der Lektion – erst ab einem Stern, sonst lieber nochmal */
  protected readonly nextStep = computed(() => {
    const lesson = this.settings()?.lesson;
    return lesson && this.summary().stars >= 1 ? followingStep(lesson.step) : null;
  });
  private readonly profile = inject(ProfileStore).active;

  ngOnInit(): void {
    if (this.celebrate()) this.sound.play('finish');
  }

  protected topicTitle(topicId: string): string {
    return findTopic(topicId)?.title ?? '';
  }

  protected stepName(step: LessonStep): string {
    return step === 'test' ? 'Zum Test' : `Weiter zu ${stepLabel(step)}`;
  }

  protected startStep(step: LessonStep): void {
    const settings = this.settings();
    if (!settings?.lesson) return;
    this.session.start(lessonSettings(settings.grade, settings.lesson.topicId, step, this.profile()?.state ?? settings.state));
    void this.router.navigate(['/quiz']);
  }

  protected playAgain(): void {
    try {
      this.session.restart();
      void this.router.navigate(['/quiz']);
    } catch {
      // Wiederholung ohne verbliebene Fehler – alles gelernt
      void this.router.navigate(['/']);
    }
  }
}
