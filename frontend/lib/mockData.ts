import type { Agent, Event, Task } from '@/types/models';

export const mockAgents: Agent[] = [
  { id: 'a-1', name: 'Iris', role: 'Coordinator', status: 'busy', updatedAt: '2026-03-07T03:58:00Z' },
  { id: 'a-2', name: 'Bolt', role: 'Builder', status: 'offline', updatedAt: '2026-03-07T04:02:00Z' },
  { id: 'a-3', name: 'Mika', role: 'Analyst', status: 'idle', updatedAt: '2026-03-07T04:07:00Z' }
];

export const mockTasks: Task[] = [
  {
    id: 't-1',
    title: 'Implement Overview dashboard cards',
    status: 'in_progress',
    assigneeAgentId: 'a-1',
    priority: 'high',
    createdAt: '2026-03-07T03:00:00Z',
    updatedAt: '2026-03-07T04:00:00Z'
  },
  {
    id: 't-2',
    title: 'Wire agent controls API',
    status: 'blocked',
    assigneeAgentId: 'a-2',
    priority: 'high',
    createdAt: '2026-03-07T03:10:00Z',
    updatedAt: '2026-03-07T04:10:00Z'
  },
  {
    id: 't-3',
    title: 'Document deployment checks',
    status: 'todo',
    assigneeAgentId: 'a-3',
    priority: 'low',
    createdAt: '2026-03-07T03:30:00Z',
    updatedAt: '2026-03-07T03:30:00Z'
  }
];

export const mockEvents: Event[] = [
  { id: 'e-1', timestamp: '2026-03-07T04:11:00Z', level: 'error', type: 'task.blocked', message: 'QA pipeline reported failing specs' },
  { id: 'e-2', timestamp: '2026-03-07T04:08:00Z', level: 'warning', type: 'task.updated', message: 'API contract missing auth field' },
  { id: 'e-3', timestamp: '2026-03-07T04:04:00Z', level: 'info', type: 'agent.status', message: 'Iris switched to busy' }
];
