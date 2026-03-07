import type { Agent, AgentStatus, Event, EventLevel, Task, TaskStatus } from '@/types/models';

const AGENT_STATUSES: AgentStatus[] = ['idle', 'busy', 'offline'];
const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];
const EVENT_LEVELS: EventLevel[] = ['info', 'warning', 'error'];

function includesValue<T extends string>(list: T[], value: string | undefined): value is T {
  return value !== undefined && list.includes(value as T);
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

export function normalizeEventLevel(level: string | undefined, type: string): EventLevel {
  if (includesValue(EVENT_LEVELS, level)) {
    return level;
  }
  return mapEventLevelFromType(type);
}

export function getEventLevelWeight(level: EventLevel): number {
  if (level === 'error') return 3;
  if (level === 'warning') return 2;
  return 1;
}

export function isErrorLevel(level: EventLevel): boolean {
  return level === 'error';
}

export type ApiEventShape = Omit<Event, 'level'> & Partial<Pick<Event, 'level'>>;

export function normalizeEvent(event: ApiEventShape): Event {
  return {
    ...event,
    level: normalizeEventLevel(event.level, event.type)
  };
}

export type ApiAgentShape = Omit<Agent, 'status'> & Partial<Pick<Agent, 'status'>>;
export type ApiTaskShape = Omit<Task, 'status'> & Partial<Pick<Task, 'status'>>;

export function normalizeAgent(agent: ApiAgentShape): Agent {
  return {
    ...agent,
    status: normalizeAgentStatus(agent.status)
  };
}

export function normalizeTask(task: ApiTaskShape): Task {
  return {
    ...task,
    status: normalizeTaskStatus(task.status)
  };
}
