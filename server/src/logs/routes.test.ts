import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';
import { createTestServer, jsonHeaders, type TestServer } from '../test-helpers.js';

describe('logs route', () => {
  let server: TestServer;

  before(async () => {
    server = await createTestServer();
  });
  after(() => server.close());

  it('writes a client report as one JSON line to the server log', async () => {
    const errorLog = mock.method(console, 'error', () => {});
    try {
      const res = await server.request('/api/logs', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ kind: 'error', message: 'Boom', url: '/quiz', breadcrumbs: [{ event: 'answer' }], stack: 'x'.repeat(10_000) }),
      });
      assert.equal(res.status, 204);
      const line = String(errorLog.mock.calls.at(-1)?.arguments[0]);
      assert.ok(line.startsWith('[client] '));
      const entry = JSON.parse(line.slice('[client] '.length));
      assert.equal(entry.message, 'Boom');
      assert.equal(entry.url, '/quiz');
      assert.ok(entry.stack.length <= 4000, 'long fields are clipped');
    } finally {
      errorLog.mock.restore();
    }
  });
});
