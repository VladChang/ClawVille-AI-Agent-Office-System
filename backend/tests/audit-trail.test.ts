import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { apiRoutes } from '../src/routes/api';

async function createApp() {
  const app = Fastify();
  await app.register(apiRoutes, { prefix: '/api' });
  return app;
}

test('mutation actions are captured in audit trail endpoint', async () => {
  process.env.AUTH_MODE = 'header';
  const app = await createApp();

  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { 'x-operator-id': 'audit-user', 'x-operator-role': 'operator' },
      payload: { title: 'audit task', priority: 'medium' }
    });
    assert.equal(created.statusCode, 201);

    const audit = await app.inject({ method: 'GET', url: '/api/audit?limit=20' });
    assert.equal(audit.statusCode, 200);

    const body = audit.json();
    assert.equal(body.success, true);
    const matched = (body.data as Array<{ action: string; actorId: string; result: string }>).find(
      (entry) => entry.action === 'task.create' && entry.actorId === 'audit-user' && entry.result === 'success'
    );

    assert.ok(matched);
  } finally {
    await app.close();
    delete process.env.AUTH_MODE;
  }
});
