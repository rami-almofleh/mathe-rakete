import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { resetDb } from '../db/connection.js';
import { authHeader, createTestServer, jsonHeaders, registerUser, validProfile, type TestServer } from '../test-helpers.js';

describe('profiles routes', () => {
  let server: TestServer;

  before(async () => {
    server = await createTestServer();
  });
  after(() => server.close());
  afterEach(() => resetDb());

  it('starts empty and creates a profile that becomes active', async () => {
    const { token } = await registerUser(server, 'lena@test.de');
    const empty = await server.request('/api/profiles', { headers: authHeader(token) });
    assert.deepEqual(await empty.json(), { profiles: [], activeId: null, totalStars: {} });

    const created = await server.request('/api/profiles', { method: 'POST', headers: { ...jsonHeaders, ...authHeader(token) }, body: JSON.stringify(validProfile) });
    assert.equal(created.status, 201);
    const profile = (await created.json()) as { id: string };
    assert.ok(profile.id);

    const list = await server.request('/api/profiles', { headers: authHeader(token) });
    const body = (await list.json()) as { profiles: unknown[]; activeId: string; totalStars: Record<string, number> };
    assert.equal(body.profiles.length, 1);
    assert.equal(body.activeId, profile.id);
    assert.equal(body.totalStars[profile.id], 0);
  });

  it('rejects an invalid draft (missing name)', async () => {
    const { token } = await registerUser(server, 'lena@test.de');
    const res = await server.request('/api/profiles', { method: 'POST', headers: { ...jsonHeaders, ...authHeader(token) }, body: JSON.stringify({ ...validProfile, name: '' }) });
    assert.equal(res.status, 400);
  });

  it('lets the owner update and delete their profile, but not another user', async () => {
    const { token: tokenA } = await registerUser(server, 'a@test.de');
    const { token: tokenB } = await registerUser(server, 'b@test.de');
    const created = (await (await server.request('/api/profiles', { method: 'POST', headers: { ...jsonHeaders, ...authHeader(tokenA) }, body: JSON.stringify(validProfile) })).json()) as { id: string };

    const foreignUpdate = await server.request(`/api/profiles/${created.id}`, { method: 'PUT', headers: { ...jsonHeaders, ...authHeader(tokenB) }, body: JSON.stringify({ ...validProfile, name: 'Tom' }) });
    assert.equal(foreignUpdate.status, 404);
    const foreignDelete = await server.request(`/api/profiles/${created.id}`, { method: 'DELETE', headers: authHeader(tokenB) });
    assert.equal(foreignDelete.status, 404);

    const ownUpdate = await server.request(`/api/profiles/${created.id}`, { method: 'PUT', headers: { ...jsonHeaders, ...authHeader(tokenA) }, body: JSON.stringify({ ...validProfile, name: 'Umbenannt' }) });
    assert.equal(ownUpdate.status, 200);
    assert.equal(((await ownUpdate.json()) as { name: string }).name, 'Umbenannt');

    const ownDelete = await server.request(`/api/profiles/${created.id}`, { method: 'DELETE', headers: authHeader(tokenA) });
    assert.equal(ownDelete.status, 204);
    const list = await server.request('/api/profiles', { headers: authHeader(tokenA) });
    assert.deepEqual(((await list.json()) as { profiles: unknown[] }).profiles, []);
  });

  it('reassigns the active profile when the active one is deleted, and clears it when the last one goes', async () => {
    const { token } = await registerUser(server, 'lena@test.de');
    const post = (body: object) => server.request('/api/profiles', { method: 'POST', headers: { ...jsonHeaders, ...authHeader(token) }, body: JSON.stringify(body) });
    const p1 = (await (await post({ ...validProfile, name: 'Erstes' })).json()) as { id: string };
    const p2 = (await (await post({ ...validProfile, name: 'Zweites' })).json()) as { id: string };
    // p2 wurde als Letztes erzeugt und ist daher aktiv
    await server.request(`/api/profiles/${p2.id}`, { method: 'DELETE', headers: authHeader(token) });
    let list: { activeId: string | null } = (await (await server.request('/api/profiles', { headers: authHeader(token) })).json()) as { activeId: string | null };
    assert.equal(list.activeId, p1.id);

    await server.request(`/api/profiles/${p1.id}`, { method: 'DELETE', headers: authHeader(token) });
    list = (await (await server.request('/api/profiles', { headers: authHeader(token) })).json()) as { activeId: string | null };
    assert.equal(list.activeId, null);
  });

  it('lets the owner switch the active profile via PUT /active, but not to a foreign profile', async () => {
    const { token: tokenA } = await registerUser(server, 'a@test.de');
    const { token: tokenB } = await registerUser(server, 'b@test.de');
    const p1 = (await (await server.request('/api/profiles', { method: 'POST', headers: { ...jsonHeaders, ...authHeader(tokenA) }, body: JSON.stringify(validProfile) })).json()) as { id: string };
    const p2 = (await (await server.request('/api/profiles', { method: 'POST', headers: { ...jsonHeaders, ...authHeader(tokenA) }, body: JSON.stringify({ ...validProfile, name: 'Zweites' }) })).json()) as { id: string };

    const switchBack = await server.request('/api/profiles/active', { method: 'PUT', headers: { ...jsonHeaders, ...authHeader(tokenA) }, body: JSON.stringify({ id: p1.id }) });
    assert.equal(switchBack.status, 204);
    const list = (await (await server.request('/api/profiles', { headers: authHeader(tokenA) })).json()) as { activeId: string };
    assert.equal(list.activeId, p1.id);

    const foreignSwitch = await server.request('/api/profiles/active', { method: 'PUT', headers: { ...jsonHeaders, ...authHeader(tokenB) }, body: JSON.stringify({ id: p2.id }) });
    assert.equal(foreignSwitch.status, 404);
  });
});
