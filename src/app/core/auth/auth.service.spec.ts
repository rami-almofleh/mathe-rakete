import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EMPTY_PROGRESS, ProgressStore } from '../progress/progress-store';
import { ProfileDraft, ProfileStore } from '../progress/profile-store';
import { FakeApiClient } from '../testing/fake-api-client';
import { ApiClient } from './api-client';
import { AuthService } from './auth.service';
import { GUEST_DATA_KEY } from './local-api-client';
import { GUEST_KEY, TOKEN_KEY, TOKEN_STORAGE } from './token-storage';

const draft = (name: string): ProfileDraft => ({ name, icon: 'bi-star-fill', color: 'mint', grade: 2, state: 'de' });

/** Server-Konto im Speicher: Profil-/Fortschritts-Endpunkte vom Fake, dazu Login. */
class FakeServer extends FakeApiClient {
  readonly unauthorized = signal(0);

  override async post<T>(path: string, body?: unknown): Promise<T> {
    if (path === '/auth/login' || path === '/auth/register') {
      return { token: 'token-1', user: { id: 1, email: 'eltern@test.de' } } as T;
    }
    return super.post<T>(path, body);
  }
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

function setup(storage = memoryStorage(), server = new FakeServer()) {
  TestBed.configureTestingModule({
    providers: [
      { provide: ApiClient, useValue: server },
      { provide: TOKEN_STORAGE, useValue: storage },
    ],
  });
  return { auth: TestBed.inject(AuthService), profiles: TestBed.inject(ProfileStore), progress: TestBed.inject(ProgressStore), storage, server };
}

describe('AuthService – Gast-Modus', () => {
  it('speichert Gast-Profile samt Fortschritt nur im Browser, auch über einen Neustart', async () => {
    const storage = memoryStorage();
    const first = setup(storage);
    await first.auth.continueAsGuest();
    const lena = first.profiles.create(draft('Lena'));
    first.progress.setSound(true);
    await new Promise((r) => setTimeout(r));

    expect(first.server.snapshot().profiles).toEqual([]); // nichts beim Server
    expect(storage.getItem(GUEST_DATA_KEY)).toContain('Lena');

    TestBed.resetTestingModule();
    const second = setup(storage);
    await second.auth.whenReady();
    expect(second.auth.isGuest()).toBe(true);
    expect(second.auth.hasSession()).toBe(true);
    expect(second.profiles.active()?.id).toBe(lena.id);
    await second.progress.hydrate();
    expect(second.progress.sound()).toBe(true);
  });

  it('fragt nach der Anmeldung nur, übernimmt aber erst auf Wunsch', async () => {
    const { auth, profiles, storage, server } = setup();
    await auth.continueAsGuest();
    profiles.create(draft('Lena'));
    await new Promise((r) => setTimeout(r));

    await auth.login('eltern@test.de', 'geheim123');
    expect(auth.isGuest()).toBe(false);
    expect(storage.getItem(GUEST_KEY)).toBeNull();
    expect(storage.getItem(TOKEN_KEY)).toBe('token-1');
    expect(profiles.profiles()).toEqual([]); // Konto ist (noch) leer
    expect(auth.guestProfiles().map((p) => p.name)).toEqual(['Lena']); // Gast-Daten bleiben liegen
    expect(server.snapshot().profiles).toEqual([]);
  });

  it('übernimmt Gast-Profile mit Fortschritt ins Konto und räumt den Browser auf', async () => {
    const { auth, profiles, progress, server } = setup();
    await auth.continueAsGuest();
    profiles.create(draft('Lena'));
    const max = profiles.create(draft('Max'));
    progress.setSound(true);
    await new Promise((r) => setTimeout(r));

    await auth.register('eltern@test.de', 'geheim123');
    await auth.importGuestProfiles();

    expect(profiles.profiles().map((p) => p.name)).toEqual(['Lena', 'Max']);
    expect(profiles.active()?.name).toBe('Max'); // zuletzt aktives Gast-Profil bleibt aktiv
    expect(profiles.active()?.id).not.toBe(max.id); // der Server vergibt neue IDs
    expect(server.snapshot().progress[profiles.active()!.id]).toEqual({ ...EMPTY_PROGRESS, sound: true });
    expect(auth.guestProfiles()).toEqual([]);
  });

  it('macht nach einem Abbruch beim Übernehmen ohne doppelte Profile weiter', async () => {
    const { auth, profiles, server } = setup();
    await auth.continueAsGuest();
    profiles.create(draft('Lena'));
    profiles.create(draft('Max'));
    await new Promise((r) => setTimeout(r));
    await auth.login('eltern@test.de', 'geheim123');

    const post = server.post.bind(server);
    let calls = 0;
    server.post = async <T,>(path: string, body?: unknown): Promise<T> => {
      if (path === '/profiles' && ++calls === 2) throw new Error('Netzwerkfehler (simuliert)');
      return post<T>(path, body);
    };
    await expect(auth.importGuestProfiles()).rejects.toThrow();
    expect(auth.guestProfiles().map((p) => p.name)).toEqual(['Max']);

    await auth.importGuestProfiles();
    expect(profiles.profiles().map((p) => p.name)).toEqual(['Lena', 'Max']);
  });

  it('löscht Gast-Profile nur auf ausdrücklichen Wunsch', async () => {
    const { auth, profiles } = setup();
    await auth.continueAsGuest();
    profiles.create(draft('Lena'));
    await new Promise((r) => setTimeout(r));
    await auth.login('eltern@test.de', 'geheim123');

    auth.discardGuestProfiles();
    expect(auth.guestProfiles()).toEqual([]);
  });
});
