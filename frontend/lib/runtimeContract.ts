import { isTaskPriority } from '../../shared/contracts';
import { normalizeAgent, normalizeEvent, normalizeTask } from '@/lib/schema';
import type { Agent, Event, Task } from '@/types/models';

export interface RuntimeAgentPayload {
  id?: unknown;
  name?: unknown;
  role?: unknown;
  status?: unknown;
  updatedAt?: unknown;
}

export interface RuntimeTaskPayload {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  assigneeAgentId?: unknown;
  status?: unknown;
  priority?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RuntimeEventPayload {
  id?: unknown;
  timestamp?: unknown;
  level?: unknown;
  type?: unknown;
  message?: unknown;
  metadata?: unknown;
}

export interface RuntimeSnapshotPayload {
  agents?: unknown;
  tasks?: unknown;
  events?: unknown;
}

export interface RuntimeRealtimeEnvelope {
  type?: unknown;
  data?: {
    snapshot?: unknown;
    event?: unknown;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

const DEFAULT_PRIORITY: Task['priority'] = 'medium';

export function mapRuntimeAgent(payload: unknown): Agent | null {
  if (!isRecord(payload)) return null;

  const id = asString(payload.id);
  const name = asString(payload.name);
  const role = asString(payload.role);
  const updatedAt = asString(payload.updatedAt) ?? new Date(0).toISOString();

  if (!id || !name || !role) {
    return null;
  }

  return normalizeAgent({
    id,
    name,
    role,
    status: asOptionalString(payload.status) as Agent['status'] | undefined,
    updatedAt
  });
}

export function mapRuntimeTask(payload: unknown): Task | null {
  if (!isRecord(payload)) return null;

  const id = asString(payload.id);
  const title = asString(payload.title);
  const createdAt = asString(payload.createdAt) ?? new Date(0).toISOString();
  const updatedAt = asString(payload.updatedAt) ?? createdAt;

  if (!id || !title) {
    return null;
  }

  const priorityValue = asOptionalString(payload.priority);
  const priority: Task['priority'] = isTaskPriority(priorityValue) ? priorityValue : DEFAULT_PRIORITY;

  return normalizeTask({
    id,
    title,
    description: asOptionalString(payload.description),
    assigneeAgentId: asOptionalString(payload.assigneeAgentId),
    status: asOptionalString(payload.status) as Task['status'] | undefined,
    priority,
    createdAt,
    updatedAt
  });
}

export function mapRuntimeEvent(payload: unknown): Event | null {
  if (!isRecord(payload)) return null;

  const id = asString(payload.id);
  const timestamp = asString(payload.timestamp) ?? new Date(0).toISOString();
  const type = asString(payload.type);
  const message = asString(payload.message);

  if (!id || !type || !message) {
    return null;
  }

  return normalizeEvent({
    id,
    timestamp,
    type,
    message,
    level: asOptionalString(payload.level) as Event['level'] | undefined,
    metadata: asObject(payload.metadata)
  });
}

function mapRuntimeList<T>(value: unknown, mapper: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => mapper(item)).filter((item): item is T => item !== null);
}

export function mapRuntimeAgents(payload: unknown): Agent[] {
  return mapRuntimeList(payload, mapRuntimeAgent);
}

export function mapRuntimeTasks(payload: unknown): Task[] {
  return mapRuntimeList(payload, mapRuntimeTask);
}

export function mapRuntimeEvents(payload: unknown): Event[] {
  return mapRuntimeList(payload, mapRuntimeEvent);
}

export function mapRuntimeSnapshot(payload: unknown): { agents: Agent[]; tasks: Task[]; events: Event[] } | null {
  if (!isRecord(payload)) return null;

  return {
    agents: mapRuntimeAgents(payload.agents),
    tasks: mapRuntimeTasks(payload.tasks),
    events: mapRuntimeEvents(payload.events)
  };
}

export function parseRuntimeRealtimeEnvelope(payload: unknown): {
  type: 'snapshot' | 'state_changed';
  data: { snapshot: { agents: Agent[]; tasks: Task[]; events: Event[] } };
} | null {
  if (!isRecord(payload)) return null;

  const type = payload.type;
  if (type !== 'snapshot' && type !== 'state_changed') {
    return null;
  }

  if (!isRecord(payload.data)) return null;
  const snapshot = mapRuntimeSnapshot(payload.data.snapshot);
  if (!snapshot) return null;

  return {
    type,
    data: { snapshot }
  };
}

export function parseApiEnvelopeData<T>(payload: unknown, mapper: (value: unknown) => T): T {
  if (!isRecord(payload) || payload.success !== true || !('data' in payload)) {
    throw new Error('Invalid API envelope');
  }

  return mapper(payload.data);
}
