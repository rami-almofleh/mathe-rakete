import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../auth/api-client';
import { FakeApiClient } from '../testing/fake-api-client';
import { ProfileDraft, ProfileStore } from './profile-store';
import { ProgressStore } from './progress-store';

const draft = (name: string): ProfileDraft => ({ name, icon: 'bi-star-fill', color: 'mint', grade: 2, state: 'de' });

const settings = {
  grade: 2 as const,
  mode: 'topics' as const,
  operations: [],
  topicIds: [],
  difficulty: 'easy' as const,
  timer: { mode: 'off' as const },
  taskCount: 10,
};
const oneAnswer = {
  task: {
    id: '1',
    topicId: 'k2-div',
    grade: 2 as const,
    difficulty: 'easy' as const,
    prompt: { math: { kind: 'plain' as const, value: '6 : 2 = ?' } },
    choices: [
      { display: { kind: 'plain' as const, value: '3' }, key: 'a' },
      { display: { kind: 'plain' as const, value: '4' }, key: 'b' },
      { display: { kind: 'plain' as const, value: '2' }, key: 'c' },
    ] as const,
    correctIndex: 0 as const,
  },
  correct: true,
};

function setup(api: FakeApiClient = new FakeApiClient()) {
  TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: api }] });
  return { profiles: TestBed.inject(ProfileStore), progress: TestBed.inject(ProgressStore), api };
}

describe('ProfileStore', () => {
  it('creates, selects and trims profiles', () => {
    const { profiles } = setup();
    expect(profiles.active()).toBeNull();
    const lena = profiles.create(draft('  Lena  '));
    expect(lena.name).toBe('Lena');
    expect(profiles.active()?.id).toBe(lena.id);
    const tom = profiles.create(draft('Tom mit einem sehr langen Namen'));
    expect(tom.name.length).toBeLessThanOrEqual(20);
    profiles.select(lena.id);
    expect(profiles.active()?.name).toBe('Lena');
  });

  it('keeps separate progress per child', async () => {
    const { profiles, progress } = setup();
    const lena = profiles.create(draft('Lena'));
    progress.recordRound(settings, [oneAnswer], 3);
    const tom = profiles.create(draft('Tom'));
    await progress.hydrate();
    expect(progress.data().totalStars).toBe(0);
    progress.recordRound(settings, [oneAnswer], 1);
    profiles.select(lena.id);
    await progress.hydrate();
    expect(progress.data().totalStars).toBe(3);
    expect(progress.starsOf(tom.id)).toBe(1);
  });

  it('deletes a profile together with its progress', () => {
    const { profiles, progress, api } = setup();
    const lena = profiles.create(draft('Lena'));
    progress.recordRound(settings, [oneAnswer], 2);
    const tom = profiles.create(draft('Tom'));
    profiles.select(lena.id);
    profiles.remove(lena.id);
    expect(profiles.profiles().map((p) => p.name)).toEqual(['Tom']);
    expect(profiles.active()?.id).toBe(tom.id);
    expect(api.hasProgress(lena.id)).toBe(false);
  });

  it('survives a reload', async () => {
    const api = new FakeApiClient();
    setup(api).profiles.create(draft('Lena'));
    TestBed.resetTestingModule();
    const { profiles } = setup(api);
    await profiles.hydrate();
    expect(profiles.active()?.name).toBe('Lena');
  });
});
