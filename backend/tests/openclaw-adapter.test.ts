import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildOpenClawAdapterApp } from '../src/adapter/app';
import { createOpenClawAdapterServiceFromEnv } from '../src/adapter/service';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

test('openclaw adapter normalizes internal upstream payloads and persists displayName aliases', async () => {
  const originalFetch = globalThis.fetch;
  const previousEnv = {
    OPENCLAW_INTERNAL_BASE_URL: process.env.OPENCLAW_INTERNAL_BASE_URL,
    OPENCLAW_ADAPTER_ALIAS_FILE: process.env.OPENCLAW_ADAPTER_ALIAS_FILE
  };

  const tempDir = mkdtempSync(join(tmpdir(), 'clawville-adapter-'));
  process.env.OPENCLAW_INTERNAL_BASE_URL = 'http://openclaw.internal';
  process.env.OPENCLAW_ADAPTER_ALIAS_FILE = join(tempDir, 'aliases.json');

  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';

    if (method === 'GET' && url.pathname === '/health') {
      return jsonResponse({ ok: true });
    }

    if (method === 'GET' && url.pathname === '/snapshot') {
      return jsonResponse({
        agents: [
          {
            agentId: 'oc-agent-1',
            agentName: 'openclaw-alpha',
            agentRole: 'planner',
            state: 'running',
            updatedAt: '2026-03-09T00:00:00.000Z'
          }
        ],
        tasks: [
          {
            taskId: 'oc-task-1',
            taskName: '整理 runtime 契約',
            state: 'queued',
            importance: 'urgent',
            ownerId: 'oc-agent-1',
            createdAt: '2026-03-09T00:00:00.000Z',
            updatedAt: '2026-03-09T00:00:00.000Z'
          }
        ],
        events: [
          {
            eventId: 'oc-event-1',
            kind: 'task_updated',
            description: 'openclaw-alpha blocked by dependency',
            timestamp: '2026-03-09T00:00:00.000Z',
            status: 'blocked',
            agentId: 'oc-agent-1'
          }
        ]
      });
    }

    if (method === 'GET' && url.pathname === '/agents') {
      return jsonResponse({
        workers: [
          {
            workerId: 'oc-agent-1',
            workerName: 'openclaw-alpha',
            type: 'planner',
            state: 'running',
            updatedAt: '2026-03-09T00:00:00.000Z'
          }
        ]
      });
    }

    if (method === 'PATCH' && url.pathname === '/agents/oc-agent-1/display-name') {
      return jsonResponse({ success: true });
    }

    if (method === 'POST' && url.pathname === '/agents/oc-agent-1/pause') {
      return jsonResponse({
        workerId: 'oc-agent-1',
        workerName: 'openclaw-alpha',
        type: 'planner',
        state: 'paused',
        updatedAt: '2026-03-09T00:10:00.000Z'
      });
    }

    if (method === 'GET' && url.pathname === '/tasks') {
      return jsonResponse({
        jobs: [
          {
            jobId: 'oc-task-1',
            jobName: '整理 runtime 契約',
            status: 'queued',
            severity: 'urgent',
            ownerId: 'oc-agent-1',
            createdAt: '2026-03-09T00:00:00.000Z',
            updatedAt: '2026-03-09T00:00:00.000Z'
          }
        ]
      });
    }

    if (method === 'POST' && url.pathname === '/tasks/oc-task-1/retry') {
      return jsonResponse({
        jobId: 'oc-task-1',
        jobName: '整理 runtime 契約',
        status: 'running',
        severity: 'urgent',
        ownerId: 'oc-agent-1',
        createdAt: '2026-03-09T00:00:00.000Z',
        updatedAt: '2026-03-09T00:20:00.000Z'
      });
    }

    if (method === 'GET' && url.pathname === '/events') {
      return jsonResponse({
        items: [
          {
            eventId: 'oc-event-2',
            eventType: 'agent_paused',
            title: 'openclaw-alpha paused',
            createdAt: '2026-03-09T00:10:00.000Z',
            agentId: 'oc-agent-1'
          }
        ]
      });
    }

    return jsonResponse({ error: { message: `${method} ${url.pathname} not mocked` } }, 404);
  }) as typeof fetch;

  const app = await buildOpenClawAdapterApp(createOpenClawAdapterServiceFromEnv());

  try {
    const snapshot = await app.inject({ method: 'GET', url: '/snapshot' });
    assert.equal(snapshot.statusCode, 200);
    assert.equal(snapshot.json().data.snapshot.agents[0].name, 'openclaw-alpha');
    assert.equal(snapshot.json().data.snapshot.tasks[0].status, 'todo');
    assert.equal(snapshot.json().data.snapshot.events[0].level, 'error');

    const aliasUpdate = await app.inject({
      method: 'PATCH',
      url: '/agents/oc-agent-1/display-name',
      payload: { displayName: '阿爪' }
    });
    assert.equal(aliasUpdate.statusCode, 200);
    assert.equal(aliasUpdate.json().data.name, 'openclaw-alpha');
    assert.equal(aliasUpdate.json().data.displayName, '阿爪');

    const agents = await app.inject({ method: 'GET', url: '/agents' });
    assert.equal(agents.statusCode, 200);
    assert.equal(agents.json().data[0].displayName, '阿爪');

    const paused = await app.inject({ method: 'POST', url: '/agents/oc-agent-1/pause' });
    assert.equal(paused.statusCode, 200);
    assert.equal(paused.json().data.status, 'offline');

    const retried = await app.inject({ method: 'POST', url: '/tasks/oc-task-1/retry' });
    assert.equal(retried.statusCode, 200);
    assert.equal(retried.json().data.status, 'in_progress');

    const events = await app.inject({ method: 'GET', url: '/events' });
    assert.equal(events.statusCode, 200);
    assert.equal(events.json().data.some((event: { message: string }) => event.message.includes('顯示別名')), true);
  } finally {
    await app.close();
    globalThis.fetch = originalFetch;
    if (previousEnv.OPENCLAW_INTERNAL_BASE_URL === undefined) delete process.env.OPENCLAW_INTERNAL_BASE_URL;
    else process.env.OPENCLAW_INTERNAL_BASE_URL = previousEnv.OPENCLAW_INTERNAL_BASE_URL;
    if (previousEnv.OPENCLAW_ADAPTER_ALIAS_FILE === undefined) delete process.env.OPENCLAW_ADAPTER_ALIAS_FILE;
    else process.env.OPENCLAW_ADAPTER_ALIAS_FILE = previousEnv.OPENCLAW_ADAPTER_ALIAS_FILE;
  }
});
