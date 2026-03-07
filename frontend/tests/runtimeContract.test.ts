import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapRuntimeAgent,
  mapRuntimeAgents,
  mapRuntimeEvent,
  mapRuntimeEvents,
  mapRuntimeTask,
  mapRuntimeTasks,
  parseApiEnvelopeData,
  parseRuntimeRealtimeEnvelope
} from '../lib/runtimeContract';

test('mapRuntimeAgent requires core fields and normalizes invalid status', () => {
  assert.equal(mapRuntimeAgent({ id: 'a-1', name: 'Nova' }), null);

  const mapped = mapRuntimeAgent({
    id: 'a-1',
    name: 'Nova',
    role: 'Planner',
    status: 'not-valid',
    updatedAt: '2026-03-08T00:00:00.000Z'
  });

  assert.ok(mapped);
  assert.equal(mapped?.status, 'offline');
});

test('mapRuntimeTask supports partial payload fallback and rejects malformed records', () => {
  assert.equal(mapRuntimeTask({ id: 't-1' }), null);

  const mapped = mapRuntimeTask({
    id: 't-1',
    title: 'Task',
    status: 'invalid',
    priority: 'urgent'
  });

  assert.ok(mapped);
  assert.equal(mapped?.status, 'todo');
  assert.equal(mapped?.priority, 'medium');
});

test('mapRuntimeEvent derives level and filters invalid data', () => {
  assert.equal(mapRuntimeEvent({ id: 'e-1', type: 'task_updated' }), null);

  const mapped = mapRuntimeEvent({
    id: 'e-1',
    type: 'task.blocked',
    message: 'Blocked by dependency'
  });

  assert.ok(mapped);
  assert.equal(mapped?.level, 'error');
});

test('list mappers skip malformed entries instead of throwing', () => {
  const agents = mapRuntimeAgents([{ id: 'a-1', name: 'Ok', role: 'R' }, { bad: true }, null]);
  const tasks = mapRuntimeTasks([{ id: 't-1', title: 'A' }, { id: 't-2' }]);
  const events = mapRuntimeEvents([{ id: 'e-1', type: 'system', message: 'ok' }, 'bad']);

  assert.equal(agents.length, 1);
  assert.equal(tasks.length, 1);
  assert.equal(events.length, 1);
});

test('parseRuntimeRealtimeEnvelope validates contract and handles partial snapshot arrays', () => {
  assert.equal(parseRuntimeRealtimeEnvelope({ type: 'unknown' }), null);

  const parsed = parseRuntimeRealtimeEnvelope({
    type: 'snapshot',
    data: {
      snapshot: {
        agents: [{ id: 'a-1', name: 'Nova', role: 'Planner' }],
        tasks: 'bad-shape',
        events: [{ id: 'e-1', type: 'system', message: 'hi' }]
      }
    }
  });

  assert.ok(parsed);
  assert.equal(parsed?.data.snapshot.agents.length, 1);
  assert.equal(parsed?.data.snapshot.tasks.length, 0);
  assert.equal(parsed?.data.snapshot.events.length, 1);
});

test('parseApiEnvelopeData rejects invalid envelope and maps valid payloads', () => {
  assert.throws(() => parseApiEnvelopeData({ success: false }, mapRuntimeAgents), /Invalid API envelope/);

  const data = parseApiEnvelopeData(
    {
      success: true,
      data: [{ id: 'a-1', name: 'Nova', role: 'Planner' }]
    },
    mapRuntimeAgents
  );

  assert.equal(data.length, 1);
});
