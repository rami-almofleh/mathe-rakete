import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { resetDb } from '../db/connection.js';
import { authHeader, createTestServer, jsonHeaders, registerUser, type TestServer } from '../test-helpers.js';

describe('auth routes', () => {
  let server: TestServer;

  before(async () => {
    server = await createTestServer();
  });
  after(() => server.close());
  afterEach(() => resetDb());

  it('registers a new user and returns a usable token', async () => {
    const res = await server.request('/api/auth/register', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email: 'lena@test.de', password: 'geheim123' }) });
    assert.equal(res.status, 201);
    const body = (await res.json()) as { token: string; user: { id: number; email: string } };
    assert.equal(body.user.email, 'lena@test.de');
    assert.ok(body.token.length > 10);

    const me = await server.request('/api/auth/me', { headers: authHeader(body.token) });
    assert.equal(me.status, 200);
    const meBody = (await me.json()) as { user: unknown; token: string };
    assert.deepEqual(meBody.user, body.user);
    // gleitende Verlängerung: /me liefert einen neuen, gültigen Token
    const renewed = await server.request('/api/auth/me', { headers: authHeader(meBody.token) });
    assert.equal(renewed.status, 200);
  });

  it('normalizes email casing/whitespace so the same address cannot register twice', async () => {
    await registerUser(server, 'lena@test.de');
    const res = await server.request('/api/auth/register', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email: '  Lena@Test.de ', password: 'geheim123' }) });
    assert.equal(res.status, 409);
  });

  it('rejects registration with a bad email or a short password', async () => {
    const badEmail = await server.request('/api/auth/register', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email: 'not-an-email', password: 'geheim123' }) });
    assert.equal(badEmail.status, 400);
    const shortPassword = await server.request('/api/auth/register', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email: 'a@b.de', password: '1234567' }) });
    assert.equal(shortPassword.status, 400);
  });

  it('logs in with correct credentials, rejects wrong password or unknown email', async () => {
    await registerUser(server, 'lena@test.de');
    const ok = await server.request('/api/auth/login', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email: 'lena@test.de', password: 'geheim123' }) });
    assert.equal(ok.status, 200);

    const wrongPassword = await server.request('/api/auth/login', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email: 'lena@test.de', password: 'falsch12' }) });
    assert.equal(wrongPassword.status, 401);

    const unknown = await server.request('/api/auth/login', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email: 'niemand@test.de', password: 'geheim123' }) });
    assert.equal(unknown.status, 401);
  });

  it('rejects /me without a token, with garbage, and with a token from a different secret', async () => {
    const noToken = await server.request('/api/auth/me');
    assert.equal(noToken.status, 401);
    const garbage = await server.request('/api/auth/me', { headers: authHeader('kaputt.kaputt.kaputt') });
    assert.equal(garbage.status, 401);
  });
});
