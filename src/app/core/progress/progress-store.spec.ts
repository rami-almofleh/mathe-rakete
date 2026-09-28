import { TestBed } from '@angular/core/testing';
import { plain, QuizSettings, Task } from '../models';
import { ProfileStore, progressKey } from './profile-store';
import { EMPTY_PROGRESS, parseProgress, PROGRESS_STORAGE, ProgressStore } from './progress-store';

const settings: QuizSettings = {
  grade: 3,
  mode: 'arithmetic',
  operations: ['add', 'sub', 'mul', 'div'],
  topicIds: [],
  difficulty: 'hard',
  timer: { mode: 'perTask', seconds: 20 },
  taskCount: 10,
};

/** Kleiner Speicher im Arbeitsspeicher statt localStorage. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

function storeWith(storage: Storage | null): ProgressStore {
  TestBed.configureTestingModule({ providers: [{ provide: PROGRESS_STORAGE, useValue: storage }] });
  TestBed.inject(ProfileStore).create({ name: 'Lena', icon: 'bi-star-fill', color: 'sun', grade: 3, state: 'de' });
  return TestBed.inject(ProgressStore);
}

/** Beantwortete Aufgaben: '1' = richtig, '0' = falsch; jede Aufgabe hat einen eigenen Text. */
const answers = (pattern: string, topicId = 'k3-add-1000') =>
  pattern.split('').map((c, i) => ({ task: fakeTask(topicId, `${i} + ${i} = ?`), correct: c === '1' }));

function fakeTask(topicId: string, prompt: string): Task {
  return {
    id: prompt,
    topicId,
    grade: 3,
    difficulty: 'easy',
    prompt: { math: plain(prompt) },
    choices: [
      { display: plain('1'), key: 'n:1/1' },
      { display: plain('2'), key: 'n:2/1' },
      { display: plain('3'), key: 'n:3/1' },
    ],
    correctIndex: 0,
  };
}

describe('parseProgress', () => {
  it('falls back to an empty state for missing or broken data', () => {
    expect(parseProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(parseProgress('{kaputt')).toEqual(EMPTY_PROGRESS);
    expect(parseProgress(JSON.stringify({ version: 99 }))).toEqual(EMPTY_PROGRESS);
  });

  it('repairs invalid fields', () => {
    const data = parseProgress(JSON.stringify({ version: 1, totalStars: -5, badges: ['ok', 3], lastSettings: { 42: {} } }));
    expect(data.totalStars).toBe(0);
    expect(data.badges).toEqual(['ok']);
    expect(data.lastSettings).toEqual({});
  });
});

describe('ProgressStore', () => {
  it('records rounds, topic statistics and the best streak', () => {
    const storage = memoryStorage();
    const store = storeWith(storage);
    store.recordRound(settings, answers('1111101111'), 2);
    const data = store.data();
    expect(data.roundsPlayed).toBe(1);
    expect(data.totalStars).toBe(2);
    expect(data.bestStreak).toBe(5);
    expect(data.topics['k3-add-1000']).toMatchObject({ answered: 10, correct: 9 });
    expect(data.recentRounds[0]).toMatchObject({ grade: 3, correct: 9, total: 10, stars: 2 });
    expect(store.accuracy()).toBe(0.9);
    // wirklich gespeichert
    const id = TestBed.inject(ProfileStore).activeId()!;
    expect(parseProgress(storage.getItem(progressKey(id))).roundsPlayed).toBe(1);
  });

  it('awards each badge only once', () => {
    const store = storeWith(memoryStorage());
    const first = store.recordRound(settings, answers('1111111111'), 3).map((b) => b.id);
    expect(first).toEqual(expect.arrayContaining(['first-round', 'perfect', 'streak-10', 'speedy', 'all-ops', 'hard']));
    const second = store.recordRound(settings, answers('1111111111'), 3).map((b) => b.id);
    expect(second).not.toContain('first-round');
    expect(second).not.toContain('perfect');
  });

  it('keeps mistakes for review and removes them once solved', () => {
    const store = storeWith(memoryStorage());
    store.recordRound(settings, answers('1010'), 1);
    expect(store.mistakes().map((m) => m.task.prompt.math.value)).toEqual(['3 + 3 = ?', '1 + 1 = ?']);
    // gleiche Aufgabe noch einmal falsch → Zähler steigt, bleibt einmal in der Liste
    const again = answers('1010')[1];
    store.recordRound(settings, [again], 0);
    expect(store.mistakes()[0]).toMatchObject({ wrongCount: 2 });
    expect(store.mistakes()).toHaveLength(2);
    // jetzt richtig gelöst → verschwindet
    store.recordRound({ ...settings, mode: 'review' }, [{ ...again, correct: true }], 1);
    expect(store.mistakes().map((m) => m.task.prompt.math.value)).toEqual(['3 + 3 = ?']);
  });

  it('tracks how unsure the child is per topic', () => {
    const store = storeWith(memoryStorage());
    expect(store.weakness('k1-add-10')).toBeCloseTo(0.25);
    store.recordRound(settings, answers('0000', 'k1-add-10'), 0);
    store.recordRound(settings, answers('1111', 'k1-sub-10'), 3);
    expect(store.weakness('k1-add-10')).toBeGreaterThan(0.8);
    expect(store.weakness('k1-sub-10')).toBeLessThan(0.1);
  });

  it('remembers the last settings per grade', () => {
    const store = storeWith(memoryStorage());
    store.rememberSettings(settings);
    expect(store.settingsFor(3)).toEqual(settings);
    expect(store.settingsFor(4)).toBeUndefined();
  });

  it('keeps working without storage (e.g. blocked site data)', () => {
    const store = storeWith(null);
    store.recordRound(settings, answers('11'), 1);
    expect(store.data().roundsPlayed).toBe(1);
  });

  it('survives a storage that throws', () => {
    const broken = memoryStorage();
    broken.setItem = () => {
      throw new Error('QuotaExceeded');
    };
    const store = storeWith(broken);
    expect(() => store.recordRound(settings, answers('1'), 1)).not.toThrow();
    expect(store.data().roundsPlayed).toBe(1);
  });

  it('resets everything except the sound setting', () => {
    const store = storeWith(memoryStorage());
    store.setSound(true);
    store.recordRound(settings, answers('11'), 1);
    store.reset();
    expect(store.data().roundsPlayed).toBe(0);
    expect(store.sound()).toBe(true);
  });
});
