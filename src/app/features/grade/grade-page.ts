import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { chaptersForGrade, GRADE_INFO, Topic } from '../../core/curriculum/curriculum';
import { LESSON_STEPS, parseGrade } from '../../core/models';
import { stepState, StepState } from '../../core/progress/lesson';
import { ProfileStore } from '../../core/progress/profile-store';
import { ProgressStore } from '../../core/progress/progress-store';
import { GENERATOR_REGISTRY } from '../../core/quiz/quiz-config';

/** Farbe je Bereich, der Reihe nach – wie die bunten Bilder bei ANTON, nur mit Icons. */
const CHAPTER_COLORS = ['sky', 'mint', 'sun', 'coral', 'primary'] as const;

interface LessonRow {
  readonly topic: Topic;
  readonly ready: boolean;
  /** Level 1–3 und Test, von unten nach oben im Balken */
  readonly segments: readonly StepState[];
  readonly doneCount: number;
}

/** Lektionsliste einer Klasse, gegliedert nach Bereichen (`/klasse/:grade`). */
@Component({
  selector: 'app-grade-page',
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './grade-page.html',
  styleUrl: './grade-page.scss',
})
export class GradePage {
  /** Routen-Parameter `:grade`. */
  readonly grade = input<string>();

  private readonly registry = inject(GENERATOR_REGISTRY);
  private readonly progress = inject(ProgressStore);
  private readonly profile = inject(ProfileStore).active;
  private readonly state = computed(() => this.profile()?.state ?? 'de');

  protected readonly gradeNumber = computed(() => parseGrade(this.grade()));
  protected readonly tagline = computed(() => {
    const g = this.gradeNumber();
    return g ? GRADE_INFO[g].tagline : '';
  });
  protected readonly lastLessonId = this.progress.lastLessonId;

  protected readonly groups = computed(() => {
    const g = this.gradeNumber();
    if (!g) return [];
    return chaptersForGrade(g, this.state()).map((group, i) => ({
      chapter: group.chapter,
      color: CHAPTER_COLORS[i % CHAPTER_COLORS.length],
      lessons: group.topics.map((topic) => this.row(topic)),
    }));
  });

  private row(topic: Topic): LessonRow {
    const lesson = this.progress.lesson(topic.id);
    const segments = LESSON_STEPS.map((s) => stepState(s.id, lesson.steps[s.id]));
    return { topic, ready: this.registry.has(topic.id), segments, doneCount: segments.filter((s) => s === 'done').length };
  }
}
