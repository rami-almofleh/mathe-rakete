import { TestBed } from '@angular/core/testing';
import { plain, QuizSettings, Task } from '../models';
import { ApiClient } from '../auth/api-client';
import { FakeApiClient } from '../testing/fake-api-client';
import { ProgressStore } from '../progress/progress-store';
import { QUIZ_CLOCK } from './quiz-config';
import { QuizSession } from './quiz-session';

const base: QuizSettings = {
  grade: 2,
  mode: 'arithmetic',
  operations: ['mul'],
  topicIds: [],
  difficulty: 'easy',
  timer: { mode: 'off' },
  taskCount: 5,
};

describe('QuizSession', () => {
  let clock = 0;
  let session: QuizSession;

  /** Uhr und Intervalle gemeinsam vorspulen (in 100-ms-Schritten wie der echte Timer). */
  function advance(ms: number): void {
    for (let t = 0; t < ms; t += 100) {
      clock += 100;
      vi.advanceTimersByTime(100);
    }
  }

  beforeEach(() => {
    vi.useFakeTimers();
    clock = 0;
    TestBed.configureTestingModule({
      providers: [
        { provide: QUIZ_CLOCK, useValue: () => clock },
        { provide: ApiClient, useValue: new FakeApiClient() },
      ],
    });
    session = TestBed.inject(QuizSession);
  });

  afterEach(() => {
    session.abandon();
    vi.useRealTimers();
  });

  it('plays a round with the chosen operation until the task count', () => {
    session.start(base);
    for (let i = 0; i < 5; i++) {
      const task = session.task()!;
      expect(task.topicId).toBe('k2-times-table');
      expect(session.phase()).toBe('question');
      session.answer(i < 4 ? task.correctIndex : (task.correctIndex + 1) % 3);
      expect(session.phase()).toBe('feedback');
      session.next();
    }
    expect(session.phase()).toBe('finished');
    const summary = session.summary();
    expect(summary.total).toBe(5);
    expect(summary.correct).toBe(4);
    expect(summary.stars).toBe(2);
    expect(summary.mistakes).toHaveLength(1);

    // Fortschritt wird gespeichert, erstes Abzeichen verdient
    const progress = TestBed.inject(ProgressStore).data();
    expect(progress.roundsPlayed).toBe(1);
    expect(progress.totalStars).toBe(2);
    expect(progress.topics['k2-times-table']).toMatchObject({ answered: 5, correct: 4 });
    expect(session.newBadges().map((b) => b.id)).toContain('first-round');
  });

  it('tracks the current streak', () => {
    session.start(base);
    for (let i = 0; i < 3; i++) {
      session.answer(session.task()!.correctIndex);
      session.next();
    }
    expect(session.currentStreak()).toBe(3);
    session.answer((session.task()!.correctIndex + 1) % 3);
    expect(session.currentStreak()).toBe(0);
  });

  it('ignores a second answer during feedback', () => {
    session.start(base);
    session.answer(0);
    session.answer(1);
    expect(session.records()).toHaveLength(1);
  });

  it('counts a timeout per task as wrong and pauses during feedback', () => {
    session.start({ ...base, timer: { mode: 'perTask', seconds: 10 } });
    advance(9_000);
    expect(session.phase()).toBe('question');
    expect(session.remainingMs()).toBe(1_000);
    advance(1_000);
    expect(session.phase()).toBe('feedback');
    expect(session.lastRecord()).toMatchObject({ chosenIndex: null, correct: false });

    advance(5_000); // Lösungsweg lesen kostet keine Zeit
    session.next();
    expect(session.remainingMs()).toBe(10_000);
  });

  it('ends a timed round when the time is up', () => {
    session.start({ ...base, timer: { mode: 'perRound', seconds: 60 } });
    let answered = 0;
    while (session.phase() !== 'finished' && answered < 100) {
      advance(5_000);
      if (session.phase() === 'question') {
        session.answer(session.task()!.correctIndex);
        answered++;
        advance(2_000); // Rückmeldung – Zeit steht
        session.next();
      }
    }
    expect(session.phase()).toBe('finished');
    // 60 s Runde, 5 s je Aufgabe → 11 fertige Aufgaben, die 12. wird bei 0 s abgebrochen
    expect(session.summary().total).toBe(11);
    expect(session.summary().correct).toBe(11);
  });

  it('prefers topics the child is unsure about', () => {
    const progress = TestBed.inject(ProgressStore);
    // Kind ist bei „Plus“ sehr unsicher, bei „Minus“ sicher
    const answered = (topicId: string, correct: boolean) =>
      Array.from({ length: 10 }, (_, i) => ({ task: { ...fakeTask(i), topicId }, correct }));
    progress.recordRound(base, [...answered('k2-add-100', false), ...answered('k2-sub-100', true)], 0);
    session.start({ ...base, operations: ['add', 'sub'], difficulty: 'hard', taskCount: 30 });
    const topics: string[] = [];
    for (let i = 0; i < 30; i++) {
      topics.push(session.task()!.topicId);
      session.answer(0);
      session.next();
    }
    const plus = topics.filter((t) => t === 'k2-add-100').length;
    expect(plus).toBeGreaterThan(18);
  });

  it('replays remembered mistakes with reshuffled answers', () => {
    session.start({ ...base, taskCount: 3 });
    const wrongTasks = [];
    for (let i = 0; i < 3; i++) {
      const task = session.task()!;
      wrongTasks.push(task.prompt.math.value);
      session.answer((task.correctIndex + 1) % 3);
      session.next();
    }
    expect(TestBed.inject(ProgressStore).mistakes()).toHaveLength(3);

    session.startReview();
    expect(session.settings()!.mode).toBe('review');
    const replayed = [];
    for (let i = 0; i < 3; i++) {
      const task = session.task()!;
      replayed.push(task.prompt.math.value);
      session.answer(task.correctIndex);
      session.next();
    }
    expect(replayed.sort()).toEqual(wrongTasks.sort());
    expect(session.phase()).toBe('finished');
    expect(TestBed.inject(ProgressStore).mistakes()).toHaveLength(0);
    expect(session.newBadges().map((b) => b.id)).toContain('learned');
    expect(() => session.startReview()).toThrow();
  });

  it('refuses selections without tasks', () => {
    expect(() => session.start({ ...base, grade: 1, operations: ['mul'] })).toThrow();
  });

  it('avoids repeating the same task within a round', () => {
    session.start({ ...base, taskCount: 20, operations: ['mul'], difficulty: 'medium' });
    const prompts = new Set<string>();
    for (let i = 0; i < 20; i++) {
      prompts.add(session.task()!.prompt.math.value);
      session.answer(0);
      session.next();
    }
    expect(prompts.size).toBeGreaterThanOrEqual(18);
  });
});

function fakeTask(i: number): Task {
  return {
    id: String(i),
    topicId: 'k2-add-100',
    grade: 2,
    difficulty: 'easy',
    prompt: { math: plain(`${i} + 1 = ?`) },
    choices: [
      { display: plain('1'), key: 'n:1/1' },
      { display: plain('2'), key: 'n:2/1' },
      { display: plain('3'), key: 'n:3/1' },
    ],
    correctIndex: 0,
  };
}
