import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAgentStatus, normalizeEventLevel, normalizeTaskStatus } from '../lib/schema';
import { AGENT_STATUSES, EVENT_LEVELS, TASK_STATUSES, mapEventLevelFromType } from '../../shared/contracts';

test('frontend schema normalization stays aligned with shared contracts', () => {
  assert.deepEqual(new Set(AGENT_STATUSES), new Set(['idle', 'busy', 'offline']));
  assert.deepEqual(new Set(TASK_STATUSES), new Set(['todo', 'in_progress', 'blocked', 'done']));
  assert.deepEqual(new Set(EVENT_LEVELS), new Set(['info', 'warning', 'error']));

  assert.equal(normalizeAgentStatus('idle'), 'idle');
  assert.equal(normalizeAgentStatus('unknown'), 'offline');
  assert.equal(normalizeTaskStatus('blocked'), 'blocked');
  assert.equal(normalizeTaskStatus('unknown'), 'todo');
  assert.equal(mapEventLevelFromType('task.blocked'), 'error');
  assert.equal(normalizeEventLevel(undefined, 'agent_paused'), 'warning');
});
