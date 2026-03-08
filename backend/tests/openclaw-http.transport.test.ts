import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpOpenClawRuntimeTransport } from '../src/runtime/openclawTransport';
import { OpenClawRuntimeSource, OpenClawTransportRuntimeClient } from '../src/runtime/openclawRuntimeSource';
import { MockRuntimeSource } from '../src/runtime/mockRuntimeSource';
import { MockStore } from '../src/store/mockStore';

type RuntimeState = {
  agents: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
};

function createRuntimeState(): RuntimeState {
  return {
    agents: [
      {
        id: 'http-a-1',
        name: 'Atlas',
        role: 'Coordinator',
        status: 'busy',
        updatedAt: '2026-03-09T00:00:00.000Z'
      }
    ],
    tasks: [
      {
        id: 'http-t-1',
        title: 'Ship HTTP runtime transport',
        status: 'blocked',
        priority: 'high',
        assigneeAgentId: 'http-a-1',
        createdAt: '2026-03-09T00:00:00.000Z',
        updatedAt: '2026-03-09T00:00:00.000Z'
      }
    ],
    events: [
      {
        id: 'http-e-1',
        type: 'task_updated',
        message: 'Initial HTTP runtime snapshot',
        timestamp: '2026-03-09T00:00:00.000Z',
        metadata: { status: 'blocked' }
      }
    ]
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

test('http openclaw transport supports snapshot, control actions, and polling subscriptions', async () => {
  const state = createRuntimeState();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    const authHeader = init?.headers ? new Headers(init.headers).get('authorization') : null;
    const method = init?.method ?? 'GET';
    const now = new Date().toISOString();

    if (authHeader !== 'Bearer test-openclaw-key') {
      return jsonResponse({ error: { message: 'Unauthorized runtime request' } }, 401);
    }

    if (method === 'GET' && url.pathname === '/snapshot') {
      return jsonResponse({
        snapshot: {
          agents: state.agents,
          tasks: state.tasks,
          events: state.events
        }
      });
    }

    if (method === 'GET' && url.pathname === '/agents') {
      return jsonResponse({ success: true, data: state.agents });
    }

    if (method === 'POST' && url.pathname === '/agents/http-a-1/pause') {
      const agent = state.agents.find((entry) => entry.id === 'http-a-1');
      if (!agent) return jsonResponse({ error: { message: 'Agent not found' } }, 404);

      agent.status = 'offline';
      agent.updatedAt = now;
      state.events.unshift({
        id: `http-e-${Date.now()}`,
        type: 'agent_paused',
        message: 'Atlas paused via HTTP runtime',
        timestamp: now,
        metadata: { agentId: 'http-a-1' }
      });
      return jsonResponse({ success: true, data: agent });
    }

    if (method === 'PATCH' && url.pathname === '/tasks/http-t-1/status') {
      const task = state.tasks.find((entry) => entry.id === 'http-t-1');
      if (!task) return jsonResponse({ error: { message: 'Task not found' } }, 404);

      const body = JSON.parse(String(init?.body ?? '{}')) as { status?: string };
      task.status = body.status ?? task.status;
      task.updatedAt = now;
      state.events.unshift({
        id: `http-e-${Date.now()}`,
        type: 'task_updated',
        message: 'HTTP runtime task status updated',
        timestamp: now,
        metadata: { taskId: 'http-t-1', status: task.status }
      });
      return jsonResponse({ success: true, data: task });
    }

    if (method === 'POST' && url.pathname === '/tasks/http-t-1/retry') {
      const task = state.tasks.find((entry) => entry.id === 'http-t-1');
      if (!task) return jsonResponse({ error: { message: 'Task not found' } }, 404);

      task.status = 'in_progress';
      task.updatedAt = now;
      state.events.unshift({
        id: `http-e-${Date.now()}`,
        type: 'task_retried',
        message: 'HTTP runtime task retried',
        timestamp: now,
        metadata: { taskId: 'http-t-1', status: 'in_progress' }
      });
      return jsonResponse({ success: true, data: task });
    }

    if (method === 'GET' && url.pathname === '/events') {
      const limit = Number(url.searchParams.get('limit') ?? state.events.length);
      return jsonResponse({ success: true, data: state.events.slice(0, Math.max(0, limit)) });
    }

    return jsonResponse({ error: { message: `Unhandled route ${method} ${url.pathname}` } }, 404);
  }) as typeof fetch;

  const transport = new HttpOpenClawRuntimeTransport({
    endpoint: 'http://runtime.local',
    apiKey: 'test-openclaw-key',
    pollMs: 25
  });
  const source = new OpenClawRuntimeSource({
    client: new OpenClawTransportRuntimeClient(transport),
    fallback: new MockRuntimeSource(new MockStore()),
    allowFallback: false
  });

  try {
    const snapshot = await source.getSnapshot();
    assert.equal(snapshot.agents[0]?.id, 'http-a-1');
    assert.equal(snapshot.events[0]?.level, 'error');

    let subscriptionSeen = false;
    const unsubscribe = source.onStateChange(({ snapshot: changedSnapshot }) => {
      subscriptionSeen = changedSnapshot.agents.some((agent) => agent.id === 'http-a-1' && agent.status === 'offline');
    });

    await new Promise((resolve) => setTimeout(resolve, 40));

    const paused = await source.pauseAgent('http-a-1');
    assert.equal(paused?.status, 'offline');

    for (let i = 0; i < 20 && !subscriptionSeen; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    const updatedTask = await source.updateTaskStatus('http-t-1', 'done');
    assert.equal(updatedTask?.status, 'done');

    const retriedTask = await source.retryTask('http-t-1');
    assert.equal(retriedTask?.status, 'in_progress');

    const events = await source.listEvents(2);
    assert.equal(events.length >= 1, true);
    assert.equal(events.every((event) => typeof event.level === 'string'), true);

    unsubscribe();
    assert.equal(subscriptionSeen, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
