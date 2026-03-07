import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_STATUSES, TASK_STATUSES } from '../../shared/contracts';
import { MockStore } from '../src/store/mockStore';

test('overview status buckets stay aligned with shared contract enums', () => {
  const store = new MockStore();
  const overview = store.getOverview();

  assert.deepEqual(Object.keys(overview.agentsByStatus).sort(), [...AGENT_STATUSES].sort());
  assert.deepEqual(Object.keys(overview.tasksByStatus).sort(), [...TASK_STATUSES].sort());
});
