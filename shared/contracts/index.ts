export const AGENT_STATUSES = ['idle', 'busy', 'offline'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const EVENT_LEVELS = ['info', 'warning', 'error'] as const;
export type EventLevel = (typeof EVENT_LEVELS)[number];

export const CONNECTION_STATUSES = ['idle', 'connecting', 'connected', 'degraded', 'disconnected'] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const CORE_EVENT_TYPES = [
  'task_created',
  'task_updated',
  'task_retried',
  'agent_status_changed',
  'agent_paused',
  'agent_resumed',
  'system'
] as const;

export type CoreEventType = (typeof CORE_EVENT_TYPES)[number];
export type EventType = CoreEventType | string;

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
  priority: TaskPriority;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  timestamp: string;
  level?: EventLevel;
  type: EventType;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface Overview {
  generatedAt: string;
  counts: {
    agents: number;
    tasks: number;
    events: number;
    activeAgents: number;
    openTasks: number;
  };
  agentsByStatus: Record<AgentStatus, number>;
  tasksByStatus: Record<TaskStatus, number>;
}

export interface RuntimeSnapshot {
  overview: Overview;
  agents: Agent[];
  tasks: Task[];
  events: Event[];
}

function includesValue<T extends string>(list: readonly T[], value: string | undefined): value is T {
  return value !== undefined && list.includes(value as T);
}

export function isAgentStatus(value: unknown): value is AgentStatus {
  return typeof value === 'string' && includesValue(AGENT_STATUSES, value);
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && includesValue(TASK_STATUSES, value);
}

export function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && includesValue(TASK_PRIORITIES, value);
}

export function isEventLevel(value: unknown): value is EventLevel {
  return typeof value === 'string' && includesValue(EVENT_LEVELS, value);
}

export function normalizeAgentStatus(status: string | undefined): AgentStatus {
  return includesValue(AGENT_STATUSES, status) ? status : 'offline';
}

export function normalizeTaskStatus(status: string | undefined): TaskStatus {
  return includesValue(TASK_STATUSES, status) ? status : 'todo';
}

export function mapEventLevelFromType(type: string): EventLevel {
  const value = type.toLowerCase();
  if (value.includes('blocked') || value.includes('error')) return 'error';
  if (value.includes('paused') || value.includes('retry')) return 'warning';
  return 'info';
}

function asMetadataStatus(metadata: Record<string, unknown> | undefined): string | undefined {
  const value = metadata?.status;
  return typeof value === 'string' && value.length > 0 ? value.toLowerCase() : undefined;
}

export function inferEventLevel(type: string, metadata?: Record<string, unknown>): EventLevel {
  const status = asMetadataStatus(metadata);
  if (status === 'blocked') return 'error';
  if (status === 'offline' && type.toLowerCase().includes('agent')) return 'warning';
  return mapEventLevelFromType(type);
}

export function normalizeEventLevel(
  level: string | undefined,
  type: string,
  metadata?: Record<string, unknown>
): EventLevel {
  return includesValue(EVENT_LEVELS, level) ? level : inferEventLevel(type, metadata);
}

export function getEventLevelWeight(level: EventLevel): number {
  if (level === 'error') return 3;
  if (level === 'warning') return 2;
  return 1;
}

export function isErrorLevel(level: EventLevel): boolean {
  return level === 'error';
}
