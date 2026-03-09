import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { apiRoutes } from '../src/routes/api';

async function createApp() {
  const app = Fastify();
  await app.register(apiRoutes, { prefix: '/api' });
  return app;
}

test('POST /api/agents rejects invalid enum values with a consistent validation envelope', async () => {
  const app = await createApp();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/agents',
      payload: { name: 'Validation Bot', role: 'QA', status: 'sleeping' }
    });

    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.equal(body.error.message, 'Request validation failed');
    assert.equal(Array.isArray(body.error.details), true);
    assert.equal(body.error.details.some((detail: { field: string }) => detail.field === 'body.status'), true);
  } finally {
    await app.close();
  }
});

test('POST /api/tasks rejects blank titles with a consistent validation envelope', async () => {
  const app = await createApp();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {
        title: '   ',
        priority: 'high'
      }
    });

    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.equal(body.error.details.some((detail: { field: string }) => detail.field === 'body.title'), true);
  } finally {
    await app.close();
  }
});

test('PATCH /api/tasks/:id/status rejects invalid status values with a consistent validation envelope', async () => {
  const app = await createApp();

  try {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/task-1/status',
      payload: { status: 'waiting' }
    });

    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.equal(body.error.details.some((detail: { field: string }) => detail.field === 'body.status'), true);
  } finally {
    await app.close();
  }
});

test('PATCH /api/agents/:id rejects aliases longer than 50 chars with a consistent validation envelope', async () => {
  const app = await createApp();

  try {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/agents/agent-1',
      payload: { displayName: '123456789012345678901234567890123456789012345678901' }
    });

    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.equal(body.error.details.some((detail: { field: string }) => detail.field === 'body.displayName'), true);
  } finally {
    await app.close();
  }
});

test('POST mutation endpoints reject blank identifier params before hitting runtime logic', async () => {
  const app = await createApp();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/agents/%20/pause'
    });

    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.equal(body.error.details.some((detail: { field: string }) => detail.field === 'params.id'), true);
  } finally {
    await app.close();
  }
});

test('GET /api/events rejects invalid query values with a consistent validation envelope', async () => {
  const app = await createApp();

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/events?limit=0'
    });

    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.equal(body.error.details.some((detail: { field: string }) => detail.field === 'querystring.limit'), true);
  } finally {
    await app.close();
  }
});
