import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { resetDb } from '../db/connection.js';
import { authHeader, createTestServer, jsonHeaders, registerUser, validProfile, type TestServer } from '../test-helpers.js';

const sampleProgress = {
  version: 1,
  totalStars: 12,
  roundsPlayed: 3,
  bestStreak: 8,
  topics: { 'k2-times-table': { answered: 10, correct: 9 } },
  recentRounds: [],
  badges: ['first-round'],
  lastSettings: {},
  mistakes: [],
  sound: true,
};

async function createProfile(server: TestServer, token: string) {
  const res = await server.request('/api/profiles', { method: 'POST', headers: { ...jsonHeaders, ...authHeader(token) }, body: JSON.stringify(validProfile) });
  return (await res.json()) as { id: string };
}

describe('progress routes', () => {
  let server: TestServer;

  before(async () => {
    server = await createTestServer();
  });
  after(() => server.close());
  afterEach(() => resetDb());

  it('returns the empty default before anything was ever saved', async () => {
    const { token } = await registerUser(server, 'lena@test.de');
    const profile = await createProfile(server, token);
    const res = await server.request(`/api/progress/${profile.id}`, { headers: authHeader(token) });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      version: 1, totalStars: 0, roundsPlayed: 0, bestStreak: 0, topics: {}, recentRounds: [], badges: [], lastSettings: {}, mistakes: [], sound: false, lessons: {},
    });
  });

  it('round-trips a full snapshot and keeps the profile-list star cache in sync', async () => {
    const { token } = await registerUser(server, 'lena@test.de');
    const profile = await createProfile(server, token);

    const put = await server.request(`/api/progress/${profile.id}`, { method: 'PUT', headers: { ...jsonHeaders, ...authHeader(token) }, body: JSON.stringify(sampleProgress) });
    assert.equal(put.status, 204);

    const got = await server.request(`/api/progress/${profile.id}`, { headers: authHeader(token) });
    assert.deepEqual(await got.json(), sampleProgress);

    const list = (await (await server.request('/api/profiles', { headers: authHeader(token) })).json()) as { totalStars: Record<string, number> };
    assert.equal(list.totalStars[profile.id], 12);
  });

  it('rejects a body without version: 1', async () => {
    const { token } = await registerUser(server, 'lena@test.de');
    const profile = await createProfile(server, token);
    const res = await server.request(`/api/progress/${profile.id}`, { method: 'PUT', headers: { ...jsonHeaders, ...authHeader(token) }, body: JSON.stringify({ totalStars: 5 }) });
    assert.equal(res.status, 400);
  });

  it('never lets one user read or write another user\'s progress', async () => {
    const { token: tokenA } = await registerUser(server, 'a@test.de');
    const { token: tokenB } = await registerUser(server, 'b@test.de');
    const profile = await createProfile(server, tokenA);

    const read = await server.request(`/api/progress/${profile.id}`, { headers: authHeader(tokenB) });
    assert.equal(read.status, 404);
    const write = await server.request(`/api/progress/${profile.id}`, { method: 'PUT', headers: { ...jsonHeaders, ...authHeader(tokenB) }, body: JSON.stringify(sampleProgress) });
    assert.equal(write.status, 404);
  });

  it('deletes progress along with its profile (cascade)', async () => {
    const { token } = await registerUser(server, 'lena@test.de');
    const profile = await createProfile(server, token);
    await server.request(`/api/progress/${profile.id}`, { method: 'PUT', headers: { ...jsonHeaders, ...authHeader(token) }, body: JSON.stringify(sampleProgress) });
    await server.request(`/api/profiles/${profile.id}`, { method: 'DELETE', headers: authHeader(token) });

    // Ein neues Profil mit absichtlich derselben ID darf nicht den alten Fortschritt erben.
    const recreated = await server.request('/api/profiles', { method: 'POST', headers: { ...jsonHeaders, ...authHeader(token) }, body: JSON.stringify({ ...validProfile, id: profile.id }) });
    assert.equal(recreated.status, 201);
    const res = await server.request(`/api/progress/${profile.id}`, { headers: authHeader(token) });
    assert.equal(((await res.json()) as { totalStars: number }).totalStars, 0);
  });
});
