import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardDerivedState } from '../lib/dashboardDerivedState';
import type { Agent, Task } from '../types/models';

test('buildDashboardDerivedState precomputes counts and lookup maps', () => {
  const agents: Agent[] = [
    { id: 'a-1', name: 'Nova', role: 'Planner', status: 'busy', updatedAt: '2026-03-08T00:00:00Z' },
    { id: 'a-2', name: 'Echo', role: 'Reviewer', status: 'offline', updatedAt: '2026-03-08T00:00:00Z' }
  ];

  const tasks: Task[] = [
    {
      id: 't-1',
      title: 'Active task',
      assigneeAgentId: 'a-1',
      status: 'in_progress',
      priority: 'high',
      createdAt: '2026-03-08T00:00:00Z',
      updatedAt: '2026-03-08T00:10:00Z'
    },
    {
      id: 't-2',
      title: 'Blocked task',
      assigneeAgentId: 'a-2',
      status: 'blocked',
      priority: 'medium',
      createdAt: '2026-03-08T00:00:00Z',
      updatedAt: '2026-03-08T00:15:00Z'
    },
    {
      id: 't-3',
      title: 'Done task',
      assigneeAgentId: 'a-1',
      status: 'done',
      priority: 'low',
      createdAt: '2026-03-08T00:00:00Z',
      updatedAt: '2026-03-08T00:20:00Z'
    }
  ];

  const derived = buildDashboardDerivedState(agents, tasks);

  assert.equal(derived.activeAgentCount, 1);
  assert.equal(derived.blockedTaskCount, 1);
  assert.equal(derived.agentNameById['a-1'], 'Nova');
  assert.equal(derived.currentTaskByAgentId['a-1']?.id, 't-1');
  assert.equal(derived.blockedTaskByAgentId['a-2']?.id, 't-2');
});
