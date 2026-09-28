import { TestBed } from '@angular/core/testing';
import { LEGACY_PROGRESS_KEY, ProfileDraft, ProfileStore, progressKey } from './profile-store';
import { PROGRESS_STORAGE, ProgressStore } from './progress-store';

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

const draft = (name: string): ProfileDraft => ({ name, icon: 'bi-star-fill', color: 'mint', grade: 2, state: 'de' });

function setup(storage: Storage) {
  TestBed.configureTestingModule({ providers: [{ provide: PROGRESS_STORAGE, useValue: storage }] });
  return { profiles: TestBed.inject(ProfileStore), progress: TestBed.inject(ProgressStore) };
}

const settings = { grade: 2 as const, mode: 'topics' as const, operations: [], topicIds: [], difficulty: 'easy' as const, timer: { mode: 'off' as const }, taskCount: 10 };
const oneAnswer = { task: { id: '1', topicId: 'k2-div', grade: 2 as const, difficulty: 'easy' as const, prompt: { math: { kind: 'plain' as const, value: '6 : 2 = ?' } }, choices: [{ display: { kind: 'plain' as const, value: '3' }, key: 'a' }, { display: { kind: 'plain' as const, value: '4' }, key: 'b' }, { display: { kind: 'plain' as const, value: '2' }, key: 'c' }] as const, correctIndex: 0 as const }, correct: true };

describe('ProfileStore', () => {
  it('creates, selects and trims profiles', () => {
    const { profiles } = setup(memoryStorage());
    expect(profiles.active()).toBeNull();
    const lena = profiles.create(draft('  Lena  '));
    expect(lena.name).toBe('Lena');
    expect(profiles.active()?.id).toBe(lena.id);
    const tom = profiles.create(draft('Tom mit einem sehr langen Namen'));
    expect(tom.name.length).toBeLessThanOrEqual(20);
    profiles.select(lena.id);
    expect(profiles.active()?.name).toBe('Lena');
  });

  it('keeps separate progress per child', () => {
    const { profiles, progress } = setup(memoryStorage());
    const lena = profiles.create(draft('Lena'));
    progress.recordRound(settings, [oneAnswer], 3);
    const tom = profiles.create(draft('Tom'));
    expect(progress.data().totalStars).toBe(0);
    progress.recordRound(settings, [oneAnswer], 1);
    profiles.select(lena.id);
    expect(progress.data().totalStars).toBe(3);
    expect(progress.starsOf(tom.id)).toBe(1);
  });

  it('gives the progress from before profiles to the first child', () => {
    const legacy = JSON.stringify({ version: 1, totalStars: 7, roundsPlayed: 2 });
    const storage = memoryStorage({ [LEGACY_PROGRESS_KEY]: legacy });
    const { profiles, progress } = setup(storage);
    const first = profiles.create(draft('Lena'));
    expect(progress.data().totalStars).toBe(7);
    expect(storage.getItem(LEGACY_PROGRESS_KEY)).toBeNull();
    expect(storage.getItem(progressKey(first.id))).toBe(legacy);
  });

  it('deletes a profile together with its progress', () => {
    const storage = memoryStorage();
    const { profiles, progress } = setup(storage);
    const lena = profiles.create(draft('Lena'));
    progress.recordRound(settings, [oneAnswer], 2);
    const tom = profiles.create(draft('Tom'));
    profiles.select(lena.id);
    profiles.remove(lena.id);
    expect(profiles.profiles().map((p) => p.name)).toEqual(['Tom']);
    expect(profiles.active()?.id).toBe(tom.id);
    expect(storage.getItem(progressKey(lena.id))).toBeNull();
  });

  it('survives a reload', () => {
    const storage = memoryStorage();
    setup(storage).profiles.create(draft('Lena'));
    TestBed.resetTestingModule();
    const { profiles } = setup(storage);
    expect(profiles.active()?.name).toBe('Lena');
  });
});
