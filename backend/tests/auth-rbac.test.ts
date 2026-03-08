import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { apiRoutes } from '../src/routes/api';

async function createApp() {
  const app = Fastify();
  await app.register(apiRoutes, { prefix: '/api' });
  return app;
}

test('mutation endpoint rejects missing headers when AUTH_MODE=header', async () => {
  process.env.AUTH_MODE = 'header';
  const app = await createApp();

  try {
    const res = await app.inject({ method: 'POST', url: '/api/tasks', payload: { title: 'x', priority: 'high' } });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error.code, 'UNAUTHORIZED');
  } finally {
    await app.close();
    delete process.env.AUTH_MODE;
  }
});

test('viewer role cannot mutate, operator role can mutate when AUTH_MODE=header', async () => {
  process.env.AUTH_MODE = 'header';
  const app = await createApp();

  try {
    const denied = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { 'x-operator-id': 'u-viewer', 'x-operator-role': 'viewer' },
      payload: { title: 'x', priority: 'high' }
    });

    assert.equal(denied.statusCode, 403);
    assert.equal(denied.json().error.code, 'FORBIDDEN');

    const allowed = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { 'x-operator-id': 'u-operator', 'x-operator-role': 'operator' },
      payload: { title: 'ok', priority: 'high' }
    });

    assert.equal(allowed.statusCode, 201);
    assert.equal(allowed.json().success, true);
  } finally {
    await app.close();
    delete process.env.AUTH_MODE;
  }
});
