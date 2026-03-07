import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { apiRoutes } from '../src/routes/api';

async function createApp() {
  const app = Fastify();
  await app.register(apiRoutes, { prefix: '/api' });
  return app;
}

test('GET /api/overview keeps success envelope and summary shape', async () => {
  const app = await createApp();

  try {
    const response = await app.inject({ method: 'GET', url: '/api/overview' });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.success, true);
    assert.equal(typeof body.data.generatedAt, 'string');

    assert.equal(typeof body.data.counts.agents, 'number');
    assert.equal(typeof body.data.counts.tasks, 'number');
    assert.equal(typeof body.data.counts.events, 'number');
    assert.equal(typeof body.data.counts.activeAgents, 'number');
    assert.equal(typeof body.data.counts.openTasks, 'number');
  } finally {
    await app.close();
  }
});

test('GET /api/events?limit=1 keeps limit behavior and envelope', async () => {
  const app = await createApp();

  try {
    const response = await app.inject({ method: 'GET', url: '/api/events?limit=1' });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.success, true);
    assert.equal(Array.isArray(body.data), true);
    assert.equal(body.data.length <= 1, true);
  } finally {
    await app.close();
  }
});
