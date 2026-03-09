import { isErrorLevel } from '@/lib/schema';
import { getAgentLabel, workforceLabels } from '@/lib/presentation';
import type {
  Agent,
  Task,
  Event,
  DashboardDerivedMetrics,
  BusiestAgentMetric,
  AverageWaitTimeMetric,
  ErrorRateMetric
} from '@/types/models';

const ACTIVE_TASK_STATUSES: Task['status'][] = ['todo', 'in_progress', 'blocked'];
const WAIT_TASK_STATUSES: Task['status'][] = ['todo', 'blocked'];

function isValidDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function getBusiestAgentByActiveTasks(agents: Agent[], tasks: Task[]): BusiestAgentMetric | null {
  const activeByAgent = new Map<string, number>();

  for (const task of tasks) {
    if (!task.assigneeAgentId || !ACTIVE_TASK_STATUSES.includes(task.status)) continue;
    activeByAgent.set(task.assigneeAgentId, (activeByAgent.get(task.assigneeAgentId) ?? 0) + 1);
  }

  if (activeByAgent.size === 0) return null;

  let bestAgentId = '';
  let bestCount = -1;

  for (const [agentId, count] of activeByAgent.entries()) {
    if (count > bestCount || (count === bestCount && agentId < bestAgentId)) {
      bestAgentId = agentId;
      bestCount = count;
    }
  }

  const agentName = agents.find((agent) => agent.id === bestAgentId);

  return {
    agentId: bestAgentId,
    name: agentName ? getAgentLabel(agentName) : workforceLabels.unknown,
    activeTaskCount: bestCount
  };
}

export function getAverageWaitTimeMinutes(tasks: Task[], now: Date = new Date()): AverageWaitTimeMetric {
  const nowMs = now.getTime();
  let totalMinutes = 0;
  let count = 0;

  for (const task of tasks) {
    if (!WAIT_TASK_STATUSES.includes(task.status)) continue;
    if (!isValidDate(task.createdAt)) continue;

    const ageMinutes = Math.max(0, (nowMs - new Date(task.createdAt).getTime()) / 60_000);
    totalMinutes += ageMinutes;
    count += 1;
  }

  return {
    valueMinutes: count > 0 ? roundTo(totalMinutes / count, 1) : 0,
    taskCount: count
  };
}

export function getErrorRateFromEvents(events: Event[]): ErrorRateMetric {
  if (events.length === 0) {
    return {
      ratio: 0,
      percentage: 0,
      errorCount: 0,
      totalCount: 0
    };
  }

  const errorCount = events.filter((event) => isErrorLevel(event.level)).length;
  const ratio = errorCount / events.length;

  return {
    ratio: roundTo(ratio, 4),
    percentage: roundTo(ratio * 100, 1),
    errorCount,
    totalCount: events.length
  };
}

export function getDashboardDerivedMetrics(agents: Agent[], tasks: Task[], events: Event[], now: Date = new Date()): DashboardDerivedMetrics {
  return {
    busiestAgent: getBusiestAgentByActiveTasks(agents, tasks),
    averageWaitTime: getAverageWaitTimeMinutes(tasks, now),
    errorRate: getErrorRateFromEvents(events)
  };
}
