export type AgentStatus = 'idle' | 'busy' | 'offline';
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type EventLevel = 'info' | 'warning' | 'error';

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assigneeAgentId?: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  timestamp: string;
  level: EventLevel;
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
}

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
  overview: unknown;
  agents: Agent[];
  tasks: Task[];
  events: Event[];
}
