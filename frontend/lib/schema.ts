import {
  getEventLevelWeight,
  inferEventLevel,
  isErrorLevel,
  mapEventLevelFromType,
  normalizeAgentStatus,
  normalizeEventLevel,
  normalizeTaskStatus
} from '../../shared/contracts';
import type { Agent, Event, Task } from '@/types/models';

export { getEventLevelWeight, inferEventLevel, isErrorLevel, mapEventLevelFromType, normalizeAgentStatus, normalizeEventLevel, normalizeTaskStatus };

export type ApiEventShape = Omit<Event, 'level'> & Partial<Pick<Event, 'level'>>;

export function normalizeEvent(event: ApiEventShape): Event {
  return {
    ...event,
    level: normalizeEventLevel(event.level, event.type, event.metadata)
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
