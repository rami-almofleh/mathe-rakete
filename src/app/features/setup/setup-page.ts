import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GRADE_INFO, topicsForGrade } from '../../core/curriculum/curriculum';
import { DIFFICULTIES, Difficulty, Grade, Operation, OPERATIONS, parseGrade, QuizMode, QuizSettings, TimerSetting } from '../../core/models';
import {
  GENERATOR_REGISTRY,
  ROUND_SECONDS_OPTIONS,
  suggestedTaskSeconds,
  TASK_COUNT_OPTIONS,
  TASK_SECONDS_OPTIONS,
} from '../../core/quiz/quiz-config';
import { ProfileStore } from '../../core/progress/profile-store';
import { ProgressStore } from '../../core/progress/progress-store';
import { QuizSession } from '../../core/quiz/quiz-session';
import { arithmeticPool, availableOperations, defaultTopicSelection } from '../../core/quiz/topic-pool';

type TimerMode = TimerSetting['mode'];

@Component({
  selector: 'app-setup-page',
  imports: [RouterLink],
  templateUrl: './setup-page.html',
  styleUrl: './setup-page.scss',
})
export class SetupPage {
  /** Routen-Parameter `:grade`. */
  readonly grade = input<string>();

  private readonly registry = inject(GENERATOR_REGISTRY);
  private readonly session = inject(QuizSession);
  private readonly router = inject(Router);
  private readonly progress = inject(ProgressStore);
  private readonly has = (id: string) => this.registry.has(id);
  /** Bundesland des Profils – verschiebt Themen in die dort übliche Klasse */
  private readonly profile = inject(ProfileStore).active;
  private readonly state = computed(() => this.profile()?.state ?? 'de');

  protected readonly operationInfos = OPERATIONS;
  protected readonly difficulties = DIFFICULTIES;
  protected readonly taskSecondsOptions = TASK_SECONDS_OPTIONS;
  protected readonly roundSecondsOptions = ROUND_SECONDS_OPTIONS;
  protected readonly taskCountOptions = TASK_COUNT_OPTIONS;
  protected readonly timerModes: readonly { id: TimerMode; label: string; icon: string }[] = [
    { id: 'off', label: 'Ohne Zeit', icon: 'bi-emoji-smile' },
    { id: 'perTask', label: 'Pro Aufgabe', icon: 'bi-stopwatch' },
    { id: 'perRound', label: 'Pro Runde', icon: 'bi-hourglass-split' },
  ];

  protected readonly gradeNumber = computed(() => parseGrade(this.grade()));
  protected readonly gradeInfo = computed(() => {
    const g = this.gradeNumber();
    return g ? GRADE_INFO[g] : null;
  });

  protected readonly availableOps = computed(() => {
    const g = this.gradeNumber();
    return g ? availableOperations(g, this.has, this.state()) : [];
  });

  /** Zuletzt benutzte Einstellungen dieser Klasse – das Kind muss nicht jedes Mal neu wählen. */
  private readonly stored = computed(() => {
    const g = this.gradeNumber();
    return g ? this.progress.settingsFor(g) : undefined;
  });

  /** Ab Kl. 8 gibt es keine reinen Rechenart-Themen mehr – dort sind die Themen der sinnvolle Start. */
  protected readonly mode = linkedSignal<QuizMode>(() => {
    const g = this.gradeNumber();
    const stored = this.stored()?.mode;
    if (stored === 'topics' || (stored === 'arithmetic' && this.availableOps().length)) return stored;
    return this.availableOps().length && g !== null && g <= 7 ? 'arithmetic' : 'topics';
  });
  protected readonly operations = linkedSignal<readonly Operation[]>(() => {
    const available = this.availableOps();
    const stored = this.stored()?.operations.filter((op) => available.includes(op));
    return stored?.length ? stored : available;
  });
  protected readonly selectedTopics = linkedSignal<ReadonlySet<string>>(() => {
    const g = this.gradeNumber();
    const stored = this.stored()?.topicIds.filter(this.has);
    return new Set(stored?.length ? stored : g ? defaultTopicSelection(g, this.has, this.state()) : []);
  });

  /** Themen, die im Modus „Rechnen“ tatsächlich geübt werden – zur Info für Kind und Eltern. */
  protected readonly arithmeticPreview = computed(() => {
    const g = this.gradeNumber();
    return g ? arithmeticPool(g, this.operations(), this.difficulty(), this.has, this.state()).map((e) => e.topic) : [];
  });

  protected readonly previewTitles = computed(() => [...new Set(this.arithmeticPreview().map((t) => t.title))].join(' · '));

  /** Klasse, aus der geübt wird, falls die eigene noch gar keine fertigen Aufgaben hat. */
  protected readonly fallbackGrade = computed(() => {
    const g = this.gradeNumber();
    const pool = this.arithmeticPreview();
    if (!g || !pool.length || topicsForGrade(g, this.state()).some((t) => this.has(t.id))) return null;
    return Math.max(...pool.map((t) => t.grade));
  });

  protected readonly topicGroups = computed(() => {
    const g = this.gradeNumber();
    if (!g) return [];
    return Array.from({ length: g }, (_, i) => (g - i) as Grade).map((grade) => ({
      grade,
      topics: topicsForGrade(grade, this.state()).map((topic) => ({ topic, ready: this.has(topic.id) })),
    }));
  });

  protected readonly difficulty = linkedSignal<Difficulty>(() => this.stored()?.difficulty ?? 'easy');
  protected readonly timerMode = linkedSignal<TimerMode>(() => this.stored()?.timer.mode ?? 'off');
  protected readonly suggestedSeconds = computed(() => {
    const g = this.gradeNumber();
    return g ? suggestedTaskSeconds(g, this.difficulty()) : 20;
  });
  /** Folgt der Empfehlung, wenn sich die Schwierigkeit ändert – startet aber mit dem gemerkten Wert. */
  protected readonly taskSeconds = linkedSignal<number, number>({
    source: this.suggestedSeconds,
    computation: (suggested, previous) => {
      const timer = this.stored()?.timer;
      return previous === undefined && timer?.mode === 'perTask' ? timer.seconds : suggested;
    },
  });
  protected readonly roundSeconds = linkedSignal<number>(() => {
    const timer = this.stored()?.timer;
    return timer?.mode === 'perRound' ? timer.seconds : 120;
  });
  protected readonly taskCount = linkedSignal<number>(() => this.stored()?.taskCount ?? 10);

  protected readonly canStart = computed(() =>
    this.mode() === 'arithmetic' ? this.arithmeticPreview().length > 0 : this.selectedTopics().size > 0,
  );

  protected toggleOperation(op: Operation): void {
    this.operations.update((ops) => (ops.includes(op) ? ops.filter((o) => o !== op) : [...ops, op]));
  }

  protected toggleTopic(id: string): void {
    this.selectedTopics.update((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected selectGrade(grade: Grade, selected: boolean): void {
    this.selectedTopics.update((set) => {
      const next = new Set(set);
      for (const t of topicsForGrade(grade, this.state())) {
        if (!this.has(t.id)) continue;
        if (selected) next.add(t.id);
        else next.delete(t.id);
      }
      return next;
    });
  }

  protected selectedInGrade(grade: Grade): number {
    const selected = this.selectedTopics();
    return topicsForGrade(grade, this.state()).filter((t) => selected.has(t.id)).length;
  }

  protected formatSeconds(seconds: number): string {
    return seconds >= 60 ? `${seconds / 60} min` : `${seconds} s`;
  }

  protected start(): void {
    const grade = this.gradeNumber();
    if (!grade || !this.canStart()) return;
    const mode = this.timerMode();
    const timer: TimerSetting =
      mode === 'perTask'
        ? { mode, seconds: this.taskSeconds() }
        : mode === 'perRound'
          ? { mode, seconds: this.roundSeconds() }
          : { mode: 'off' };
    const settings: QuizSettings = {
      grade,
      mode: this.mode(),
      operations: this.operations(),
      topicIds: [...this.selectedTopics()],
      difficulty: this.difficulty(),
      timer,
      taskCount: this.taskCount(),
      state: this.state(),
    };
    this.progress.rememberSettings(settings);
    this.session.start(settings);
    void this.router.navigate(['/quiz']);
  }
}
