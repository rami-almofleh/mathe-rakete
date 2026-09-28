import { Component, computed, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { findTopic } from '../../core/curriculum/curriculum';
import { ProgressStore } from '../../core/progress/progress-store';
import { SoundService } from '../../core/progress/sound';
import { formatDuration } from '../../core/quiz/quiz-config';
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

  ngOnInit(): void {
    if (this.celebrate()) this.sound.play('finish');
  }

  protected topicTitle(topicId: string): string {
    return findTopic(topicId)?.title ?? '';
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
