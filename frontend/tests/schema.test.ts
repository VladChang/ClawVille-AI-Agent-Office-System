import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAgentStatus,
  normalizeTaskStatus,
  normalizeEvent,
  normalizeEventLevel,
  mapEventLevelFromType
} from '../lib/schema';

test('normalizeAgentStatus and normalizeTaskStatus fallback safely', () => {
  assert.equal(normalizeAgentStatus('idle'), 'idle');
  assert.equal(normalizeAgentStatus('unknown'), 'offline');

  assert.equal(normalizeTaskStatus('done'), 'done');
  assert.equal(normalizeTaskStatus('not-a-status'), 'todo');
});

test('event level mapping and normalization cover websocket payload shape drift', () => {
  assert.equal(mapEventLevelFromType('task.blocked'), 'error');
  assert.equal(mapEventLevelFromType('agent_paused'), 'warning');
  assert.equal(mapEventLevelFromType('task.updated'), 'info');

  assert.equal(normalizeEventLevel(undefined, 'task.blocked'), 'error');
  assert.equal(normalizeEventLevel(undefined, 'task.retry'), 'warning');
  assert.equal(normalizeEventLevel('info', 'task.blocked'), 'info');

  const normalized = normalizeEvent({
    id: 'e-1',
    timestamp: '2026-03-07T00:00:00Z',
    type: 'task.blocked',
    message: 'blocked due to dependency'
  });

  assert.equal(normalized.level, 'error');
});
