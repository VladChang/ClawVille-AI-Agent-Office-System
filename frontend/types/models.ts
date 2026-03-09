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

export interface RuntimeStatusSnapshot {
  mode: 'mock' | 'openclaw';
  allowFallback: boolean;
  degraded: boolean;
  verified: boolean;
  dataSource:
    | 'mock'
    | 'openclaw_fixture'
    | 'openclaw_upstream'
    | 'openclaw_adapter_only'
    | 'openclaw_mock_fallback'
    | 'openclaw_strict_unconfigured';
  warning?: string;
  counts?: {
    agents: number;
    tasks: number;
    events: number;
  };
  adapter?: {
    endpoint?: string;
    endpointConfigured: boolean;
    reachable: boolean;
    configured: boolean;
    upstreamHealthy: boolean;
  };
}
