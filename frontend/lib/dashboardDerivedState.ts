import type { Agent, Task } from '@/types/models';

export interface DashboardDerivedState {
  activeAgentCount: number;
  blockedTaskCount: number;
  agentNameById: Record<string, string>;
  currentTaskByAgentId: Record<string, Task>;
  blockedTaskByAgentId: Record<string, Task>;
}

export function buildDashboardDerivedState(agents: Agent[], tasks: Task[]): DashboardDerivedState {
  const agentNameById: Record<string, string> = {};
  let activeAgentCount = 0;

  for (const agent of agents) {
    agentNameById[agent.id] = agent.name;
    if (agent.status !== 'offline') {
      activeAgentCount += 1;
    }
  }

  const currentTaskByAgentId: Record<string, Task> = {};
  const blockedTaskByAgentId: Record<string, Task> = {};
  let blockedTaskCount = 0;

  for (const task of tasks) {
    const assigneeAgentId = task.assigneeAgentId;
    if (task.status === 'blocked') {
      blockedTaskCount += 1;
      if (assigneeAgentId && !blockedTaskByAgentId[assigneeAgentId]) {
        blockedTaskByAgentId[assigneeAgentId] = task;
      }
    }

    if (assigneeAgentId && task.status !== 'done' && !currentTaskByAgentId[assigneeAgentId]) {
      currentTaskByAgentId[assigneeAgentId] = task;
    }
  }

  return {
    activeAgentCount,
    blockedTaskCount,
    agentNameById,
    currentTaskByAgentId,
    blockedTaskByAgentId
  };
}
