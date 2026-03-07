import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAverageWaitTimeMinutes,
  getBusiestAgentByActiveTasks,
  getDashboardDerivedMetrics,
  getErrorRateFromEvents
} from '../lib/analytics';
import type { Agent, Event, Task } from '../types/models';

const agents: Agent[] = [
  { id: 'a-1', name: 'Nova', role: 'Planner', status: 'busy', updatedAt: '2026-03-07T10:00:00Z' },
  { id: 'a-2', name: 'Echo', role: 'Builder', status: 'idle', updatedAt: '2026-03-07T10:00:00Z' }
];

test('getBusiestAgentByActiveTasks counts active task states and resolves name', () => {
  const tasks: Task[] = [
    {
      id: 't-1',
      title: 'one',
      assigneeAgentId: 'a-1',
      status: 'todo',
      priority: 'medium',
      createdAt: '2026-03-07T09:00:00Z',
      updatedAt: '2026-03-07T09:00:00Z'
    },
    {
      id: 't-2',
      title: 'two',
      assigneeAgentId: 'a-1',
      status: 'in_progress',
      priority: 'high',
      createdAt: '2026-03-07T09:10:00Z',
      updatedAt: '2026-03-07T09:10:00Z'
    },
    {
      id: 't-3',
      title: 'three',
      assigneeAgentId: 'a-2',
      status: 'blocked',
      priority: 'high',
      createdAt: '2026-03-07T09:20:00Z',
      updatedAt: '2026-03-07T09:20:00Z'
    },
    {
      id: 't-4',
      title: 'four',
      assigneeAgentId: 'a-2',
      status: 'done',
      priority: 'low',
      createdAt: '2026-03-07T09:30:00Z',
      updatedAt: '2026-03-07T09:30:00Z'
    }
  ];

  const metric = getBusiestAgentByActiveTasks(agents, tasks);
  assert.deepEqual(metric, {
    agentId: 'a-1',
    name: 'Nova',
    activeTaskCount: 2
  });
});

test('getAverageWaitTimeMinutes only includes todo/blocked with valid dates', () => {
  const now = new Date('2026-03-07T10:00:00Z');
  const tasks: Task[] = [
    {
      id: 't-1',
      title: 'todo-old',
      status: 'todo',
      priority: 'low',
      createdAt: '2026-03-07T09:00:00Z',
      updatedAt: '2026-03-07T09:00:00Z'
    },
    {
      id: 't-2',
      title: 'blocked-mid',
      status: 'blocked',
      priority: 'high',
      createdAt: '2026-03-07T09:30:00Z',
      updatedAt: '2026-03-07T09:30:00Z'
    },
    {
      id: 't-3',
      title: 'ignored-done',
      status: 'done',
      priority: 'high',
      createdAt: '2026-03-07T08:00:00Z',
      updatedAt: '2026-03-07T08:00:00Z'
    },
    {
      id: 't-4',
      title: 'ignored-invalid-date',
      status: 'todo',
      priority: 'medium',
      createdAt: 'invalid-date',
      updatedAt: '2026-03-07T09:50:00Z'
    }
  ];

  const metric = getAverageWaitTimeMinutes(tasks, now);
  assert.deepEqual(metric, {
    valueMinutes: 45,
    taskCount: 2
  });
});

test('getErrorRateFromEvents and getDashboardDerivedMetrics aggregate correctly', () => {
  const events: Event[] = [
    { id: 'e-1', timestamp: '2026-03-07T10:00:00Z', level: 'error', type: 'task.blocked', message: 'err1' },
    { id: 'e-2', timestamp: '2026-03-07T10:01:00Z', level: 'warning', type: 'task.retry', message: 'warn' },
    { id: 'e-3', timestamp: '2026-03-07T10:02:00Z', level: 'error', type: 'task.blocked', message: 'err2' },
    { id: 'e-4', timestamp: '2026-03-07T10:03:00Z', level: 'info', type: 'agent.status', message: 'info' }
  ];

  const errorRate = getErrorRateFromEvents(events);
  assert.deepEqual(errorRate, {
    ratio: 0.5,
    percentage: 50,
    errorCount: 2,
    totalCount: 4
  });

  const tasks: Task[] = [
    {
      id: 't-1',
      title: 'blocked',
      assigneeAgentId: 'a-2',
      status: 'blocked',
      priority: 'high',
      createdAt: '2026-03-07T09:50:00Z',
      updatedAt: '2026-03-07T09:50:00Z'
    }
  ];

  const metrics = getDashboardDerivedMetrics(agents, tasks, events, new Date('2026-03-07T10:00:00Z'));
  assert.equal(metrics.busiestAgent?.agentId, 'a-2');
  assert.equal(metrics.averageWaitTime.valueMinutes, 10);
  assert.equal(metrics.errorRate.percentage, 50);
});
