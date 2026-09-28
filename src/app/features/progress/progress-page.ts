import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { gradeOf, TOPICS } from '../../core/curriculum/curriculum';
import { DIFFICULTIES, GRADES } from '../../core/models';
import { BADGES } from '../../core/progress/badges';
import { ProfileStore } from '../../core/progress/profile-store';
import { ProgressStore } from '../../core/progress/progress-store';

@Component({
  selector: 'app-progress-page',
  imports: [RouterLink],
  templateUrl: './progress-page.html',
  styleUrl: './progress-page.scss',
})
export class ProgressPage {
  protected readonly progress = inject(ProgressStore);
  protected readonly data = this.progress.data;
  protected readonly badges = BADGES;
  private readonly profile = inject(ProfileStore).active;
  private readonly state = computed(() => this.profile()?.state ?? 'de');

  protected readonly accuracyPercent = computed(() => {
    const a = this.progress.accuracy();
    return a === null ? '–' : `${Math.round(a * 100)} %`;
  });

  /** Geübte Themen, nach Klasse gruppiert. */
  protected readonly topicsByGrade = computed(() => {
    const stats = this.data().topics;
    return GRADES.map((grade) => ({
      grade,
      topics: TOPICS.filter((t) => gradeOf(t, this.state()) === grade && stats[t.id]?.answered).map((t) => {
        const s = stats[t.id];
        const percent = Math.round((s.correct / s.answered) * 100);
        return { title: t.title, ...s, percent, level: percent >= 90 ? 'great' : percent >= 70 ? 'good' : 'practice' };
      }),
    })).filter((g) => g.topics.length);
  });

  /** Themen mit deutlicher Unsicherheit (gleitender Wert unter 70 %) */
  protected readonly weakTopics = computed(() => {
    const stats = this.data().topics;
    return TOPICS.filter((t) => (stats[t.id]?.recent ?? 1) < 0.7 && stats[t.id].answered >= 3)
      .sort((a, b) => (stats[a.id].recent ?? 1) - (stats[b.id].recent ?? 1))
      .slice(0, 8);
  });

  protected readonly rounds = computed(() =>
    this.data().recentRounds.map((r) => ({
      ...r,
      when: new Date(r.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      difficultyLabel: DIFFICULTIES.find((d) => d.id === r.difficulty)?.label ?? '',
    })),
  );

  protected reset(): void {
    if (confirm('Wirklich den ganzen Fortschritt löschen? Sterne, Abzeichen und Statistik gehen verloren.')) {
      this.progress.reset();
    }
  }
}
