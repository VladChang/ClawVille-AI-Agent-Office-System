import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { apiRoutes } from '../src/routes/api';

async function createApp() {
  const app = Fastify();
  await app.register(apiRoutes, { prefix: '/api' });
  return app;
}

test('POST /api/agents/:id/pause pauses a newly-created agent', async () => {
  const app = await createApp();

  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/agents',
      payload: { name: 'Test Pause Agent', role: 'QA' }
    });

    assert.equal(created.statusCode, 201);
    const createdBody = created.json();
    const agentId = createdBody.data.id as string;

    const paused = await app.inject({ method: 'POST', url: `/api/agents/${agentId}/pause` });
    assert.equal(paused.statusCode, 200);

    const body = paused.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, agentId);
    assert.equal(body.data.status, 'offline');
  } finally {
    await app.close();
  }
});

test('POST /api/agents/:id/resume resumes a paused agent', async () => {
  const app = await createApp();

  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/agents',
      payload: { name: 'Test Resume Agent', role: 'QA', status: 'busy' }
    });

    const agentId = created.json().data.id as string;
    await app.inject({ method: 'POST', url: `/api/agents/${agentId}/pause` });

    const resumed = await app.inject({ method: 'POST', url: `/api/agents/${agentId}/resume` });
    assert.equal(resumed.statusCode, 200);

    const body = resumed.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, agentId);
    assert.equal(body.data.status, 'idle');
  } finally {
    await app.close();
  }
});

test('POST /api/tasks/:id/retry moves blocked task to in_progress', async () => {
  const app = await createApp();

  try {
    const createdTask = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {
        title: 'Test Retry Task',
        priority: 'high',
        status: 'blocked'
      }
    });

    assert.equal(createdTask.statusCode, 201);
    const taskId = createdTask.json().data.id as string;

    const retried = await app.inject({ method: 'POST', url: `/api/tasks/${taskId}/retry` });
    assert.equal(retried.statusCode, 200);

    const body = retried.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, taskId);
    assert.equal(body.data.status, 'in_progress');
  } finally {
    await app.close();
  }
});

test('control endpoints return NOT_FOUND for unknown ids', async () => {
  const app = await createApp();

  try {
    const pause = await app.inject({ method: 'POST', url: '/api/agents/does-not-exist/pause' });
    assert.equal(pause.statusCode, 404);
    assert.equal(pause.json().error.code, 'NOT_FOUND');

    const resume = await app.inject({ method: 'POST', url: '/api/agents/does-not-exist/resume' });
    assert.equal(resume.statusCode, 404);
    assert.equal(resume.json().error.code, 'NOT_FOUND');

    const retry = await app.inject({ method: 'POST', url: '/api/tasks/does-not-exist/retry' });
    assert.equal(retry.statusCode, 404);
    assert.equal(retry.json().error.code, 'NOT_FOUND');
  } finally {
    await app.close();
  }
});
