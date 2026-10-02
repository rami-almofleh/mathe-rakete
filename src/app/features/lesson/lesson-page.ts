import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { chaptersForGrade, findTopic } from '../../core/curriculum/curriculum';
import { DIFFICULTIES, LESSON_STEPS, LessonStep, parseGrade } from '../../core/models';
import { nextOpenStep, stepState } from '../../core/progress/lesson';
import { ProfileStore } from '../../core/progress/profile-store';
import { ProgressStore } from '../../core/progress/progress-store';
import { GENERATOR_REGISTRY } from '../../core/quiz/quiz-config';
import { QuizSession } from '../../core/quiz/quiz-session';
import { lessonSettings } from '../../core/quiz/topic-pool';

const STEP_ICONS: Record<LessonStep, string> = { easy: 'bi-1-circle-fill', medium: 'bi-2-circle-fill', hard: 'bi-3-circle-fill', test: 'bi-trophy-fill' };

/** Eine Lektion: Level 1–3 und Test (`/klasse/:grade/lektion/:topicId`). */
@Component({
  selector: 'app-lesson-page',
  imports: [RouterLink],
  templateUrl: './lesson-page.html',
  styleUrl: './lesson-page.scss',
})
export class LessonPage {
  /** Routen-Parameter */
  readonly grade = input<string>();
  readonly topicId = input<string>();

  private readonly registry = inject(GENERATOR_REGISTRY);
  private readonly session = inject(QuizSession);
  private readonly router = inject(Router);
  private readonly progress = inject(ProgressStore);
  private readonly profile = inject(ProfileStore).active;
  private readonly state = computed(() => this.profile()?.state ?? 'de');

  protected readonly starSlots = [1, 2, 3];
  protected readonly gradeNumber = computed(() => parseGrade(this.grade()));
  protected readonly topic = computed(() => {
    const topic = findTopic(this.topicId() ?? '');
    return topic && this.registry.has(topic.id) ? topic : null;
  });
  /** Bereich, in dem die Lektion in dieser Klasse steht (Bundesland beachtet) */
  protected readonly chapterTitle = computed(() => {
    const g = this.gradeNumber();
    const id = this.topic()?.id;
    return g ? chaptersForGrade(g, this.state()).find((c) => c.topics.some((t) => t.id === id))?.chapter.title : undefined;
  });

  private readonly lesson = computed(() => this.progress.lesson(this.topicId() ?? ''));
  protected readonly next = computed(() => nextOpenStep(this.lesson()));
  protected readonly steps = computed(() => {
    const lesson = this.lesson();
    const level1Played = lesson.steps.easy !== undefined;
    return LESSON_STEPS.map((s) => ({
      ...s,
      icon: STEP_ICONS[s.id],
      hint: s.id === 'test' ? 'Gemischt, ohne Hilfen' : DIFFICULTIES.find((d) => d.id === s.id)!.label,
      stars: lesson.steps[s.id],
      status: stepState(s.id, lesson.steps[s.id]),
      // Test erst nach Level 1 hervorheben – spielen darf man ihn trotzdem
      quiet: s.id === 'test' && !level1Played,
    }));
  });

  protected start(step: LessonStep): void {
    const g = this.gradeNumber();
    const topic = this.topic();
    if (!g || !topic) return;
    this.session.start(lessonSettings(g, topic.id, step, this.state()));
    void this.router.navigate(['/quiz']);
  }
}
