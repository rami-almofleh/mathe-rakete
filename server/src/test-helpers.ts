import type { Server } from 'node:http';
import { createApp } from './app.js';

export interface TestServer {
  request(path: string, init?: RequestInit): Promise<Response>;
  close(): Promise<void>;
}

/** Startet die App auf einem freien Port; `db/connection.ts` läuft mit NODE_ENV=test gegen `:memory:`. */
export async function createTestServer(): Promise<TestServer> {
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const address = server.address();
  const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

  return {
    request: (path, init) => fetch(`${base}${path}`, init),
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

export const jsonHeaders = { 'Content-Type': 'application/json' };
export const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function registerUser(server: TestServer, email: string, password = 'geheim123') {
  const res = await server.request('/api/auth/register', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email, password }) });
  return (await res.json()) as { token: string; user: { id: number; email: string } };
}

export const validProfile = { name: 'Lena', icon: 'bi-star-fill', color: 'sun', grade: 3, state: 'de' };
