import { AGENT_STATUSES, isTaskPriority, TASK_STATUSES } from '../../shared/contracts';
import { normalizeAgent, normalizeEvent, normalizeTask } from '@/lib/schema';
import type { Agent, DashboardSnapshot, Event, Overview, Task } from '@/types/models';

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
  overview?: unknown;
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

export interface RuntimeRealtimeContractError {
  code: 'INVALID_REALTIME_PAYLOAD';
  message: string;
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

function asNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

const DEFAULT_PRIORITY: Task['priority'] = 'medium';

function mapOverviewCounts(payload: unknown): Overview['counts'] | null {
  if (!isRecord(payload)) return null;

  const agents = asNonNegativeInteger(payload.agents);
  const tasks = asNonNegativeInteger(payload.tasks);
  const events = asNonNegativeInteger(payload.events);
  const activeAgents = asNonNegativeInteger(payload.activeAgents);
  const openTasks = asNonNegativeInteger(payload.openTasks);

  if (
    agents === undefined ||
    tasks === undefined ||
    events === undefined ||
    activeAgents === undefined ||
    openTasks === undefined
  ) {
    return null;
  }

  return { agents, tasks, events, activeAgents, openTasks };
}

function mapStatusBuckets<T extends readonly string[]>(
  payload: unknown,
  statuses: T
): Record<T[number], number> | null {
  if (!isRecord(payload)) return null;

  const result = {} as Record<T[number], number>;
  for (const status of statuses) {
    const count = asNonNegativeInteger(payload[status]);
    if (count === undefined) return null;
    result[status as T[number]] = count;
  }

  return result;
}

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

export function mapRuntimeOverview(payload: unknown): Overview | null {
  if (!isRecord(payload)) return null;

  const generatedAt = asString(payload.generatedAt);
  const counts = mapOverviewCounts(payload.counts);
  const agentsByStatus = mapStatusBuckets(payload.agentsByStatus, AGENT_STATUSES);
  const tasksByStatus = mapStatusBuckets(payload.tasksByStatus, TASK_STATUSES);

  if (!generatedAt || !counts || !agentsByStatus || !tasksByStatus) {
    return null;
  }

  return {
    generatedAt,
    counts,
    agentsByStatus,
    tasksByStatus
  };
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

export function mapRuntimeSnapshot(payload: unknown): DashboardSnapshot | null {
  if (!isRecord(payload)) return null;

  const overview = mapRuntimeOverview(payload.overview);
  if (!overview) return null;

  return {
    overview,
    agents: mapRuntimeAgents(payload.agents),
    tasks: mapRuntimeTasks(payload.tasks),
    events: mapRuntimeEvents(payload.events)
  };
}

export function decodeRuntimeRealtimeEnvelope(
  payload: unknown
):
  | {
      ok: true;
      envelope: {
        type: 'snapshot' | 'state_changed';
        data: { snapshot: DashboardSnapshot; event?: Event };
      };
    }
  | { ok: false; error: RuntimeRealtimeContractError } {
  if (!isRecord(payload)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_REALTIME_PAYLOAD',
        message: 'Realtime payload must be an object.'
      }
    };
  }

  const type = payload.type;
  if (type !== 'snapshot' && type !== 'state_changed') {
    return {
      ok: false,
      error: {
        code: 'INVALID_REALTIME_PAYLOAD',
        message: 'Realtime payload type must be "snapshot" or "state_changed".'
      }
    };
  }

  if (!isRecord(payload.data)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_REALTIME_PAYLOAD',
        message: 'Realtime payload data must be an object.'
      }
    };
  }

  const snapshot = mapRuntimeSnapshot(payload.data.snapshot);
  if (!snapshot) {
    return {
      ok: false,
      error: {
        code: 'INVALID_REALTIME_PAYLOAD',
        message: 'Realtime payload snapshot does not match the expected contract.'
      }
    };
  }

  const event = payload.data.event === undefined ? undefined : mapRuntimeEvent(payload.data.event);
  if (payload.data.event !== undefined && !event) {
    return {
      ok: false,
      error: {
        code: 'INVALID_REALTIME_PAYLOAD',
        message: 'Realtime payload event does not match the expected contract.'
      }
    };
  }

  return {
    ok: true,
    envelope: {
      type,
      data: event ? { snapshot, event } : { snapshot }
    }
  };
}

export function parseRuntimeRealtimeEnvelope(payload: unknown): {
  type: 'snapshot' | 'state_changed';
  data: { snapshot: DashboardSnapshot; event?: Event };
} | null {
  const decoded = decodeRuntimeRealtimeEnvelope(payload);
  return decoded.ok ? decoded.envelope : null;
}

export function parseApiEnvelopeData<T>(payload: unknown, mapper: (value: unknown) => T): T {
  if (!isRecord(payload) || payload.success !== true || !('data' in payload)) {
    throw new Error('Invalid API envelope');
  }

  return mapper(payload.data);
}
