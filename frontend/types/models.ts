import type { Agent, Event as SharedEvent, EventLevel, Overview, Task } from '../../shared/contracts';

export type { AgentStatus, TaskStatus, TaskPriority, EventLevel, Overview } from '../../shared/contracts';

export type Event = SharedEvent & { level: EventLevel };

export type { Agent, Task };

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface BusiestAgentMetric {
  agentId: string;
  name: string;
  activeTaskCount: number;
}

export interface AverageWaitTimeMetric {
  valueMinutes: number;
  taskCount: number;
}

export interface ErrorRateMetric {
  ratio: number;
  percentage: number;
  errorCount: number;
  totalCount: number;
}

export interface DashboardDerivedMetrics {
  busiestAgent: BusiestAgentMetric | null;
  averageWaitTime: AverageWaitTimeMetric;
  errorRate: ErrorRateMetric;
}

export interface DashboardSnapshot {
  overview: Overview;
  agents: Agent[];
  tasks: Task[];
  events: Event[];
}
