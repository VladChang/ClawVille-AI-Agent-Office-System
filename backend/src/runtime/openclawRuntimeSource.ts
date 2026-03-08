import { Agent, AgentStatus, Event, EventType, Overview, Task, TaskStatus, normalizeEventLevel } from '../models/types';
import { RuntimeSnapshot, RuntimeSource } from './runtimeSource';
import { OpenClawRuntimeRawEventEnvelope, OpenClawRuntimeTransport } from './openclawTransport';

export type OpenClawControlAgentAction = 'pause' | 'resume';
export type OpenClawControlTaskAction = 'retry' | 'update_status';

export interface OpenClawRuntimeClient {
  fetchSnapshot(): RuntimeSnapshotResult;
  listAgents(): RuntimeResult<Agent[]>;
  getAgent(agentId: string): RuntimeResult<Agent | null>;
  controlAgent(action: OpenClawControlAgentAction, agentId: string): RuntimeResult<Agent | null>;
  addAgent(payload: Pick<Agent, 'name' | 'role'> & Partial<Pick<Agent, 'status'>>): RuntimeResult<Agent>;

  listTasks(): RuntimeResult<Task[]>;
  getTask(taskId: string): RuntimeResult<Task | null>;
  controlTask(action: OpenClawControlTaskAction, taskId: string, status?: TaskStatus): RuntimeResult<Task | null>;
  addTask(payload: Pick<Task, 'title' | 'priority'> & Partial<Omit<Task, 'id' | 'title' | 'priority' | 'createdAt' | 'updatedAt'>>): RuntimeResult<Task>;

  listEvents(limit?: number): RuntimeResult<Event[]>;
  subscribe(listener: (payload: { snapshot: RuntimeSnapshot; event?: Event }) => void): () => void;
}

export type RuntimeNotConfiguredReason = 'missing-endpoint' | 'missing-credentials' | 'client-unavailable';

export type RuntimeResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: 'NOT_CONFIGURED' | 'UNAVAILABLE'; message: string; reason?: RuntimeNotConfiguredReason };

export type RuntimeSnapshotResult = RuntimeResult<RuntimeSnapshot>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function normalizeAgentStatus(value: unknown): AgentStatus {
  return value === 'idle' || value === 'busy' || value === 'offline' ? value : 'offline';
}

function normalizeTaskStatus(value: unknown): TaskStatus {
  return value === 'todo' || value === 'in_progress' || value === 'blocked' || value === 'done' ? value : 'todo';
}

function normalizeEventType(value: unknown): EventType {
  return value === 'task_created' ||
    value === 'task_updated' ||
    value === 'task_retried' ||
    value === 'agent_status_changed' ||
    value === 'agent_paused' ||
    value === 'agent_resumed' ||
    value === 'system'
    ? value
    : 'system';
}

function mapAgent(payload: unknown): Agent | null {
  const record = asRecord(payload);
  if (!record) return null;

  const id = asString(record.id);
  const name = asString(record.name);
  const role = asString(record.role);
  if (!id || !name || !role) return null;

  return {
    id,
    name,
    role,
    status: normalizeAgentStatus(record.status),
    updatedAt: asString(record.updatedAt) ?? new Date(0).toISOString()
  };
}

function mapTask(payload: unknown): Task | null {
  const record = asRecord(payload);
  if (!record) return null;

  const id = asString(record.id);
  const title = asString(record.title);
  if (!id || !title) return null;

  const priority = record.priority === 'low' || record.priority === 'medium' || record.priority === 'high' ? record.priority : 'medium';
  const createdAt = asString(record.createdAt) ?? new Date(0).toISOString();

  return {
    id,
    title,
    description: asOptionalString(record.description),
    assigneeAgentId: asOptionalString(record.assigneeAgentId),
    status: normalizeTaskStatus(record.status),
    priority,
    createdAt,
    updatedAt: asString(record.updatedAt) ?? createdAt
  };
}

function mapEvent(payload: unknown): Event | null {
  const record = asRecord(payload);
  if (!record) return null;

  const id = asString(record.id);
  const message = asString(record.message);
  if (!id || !message) return null;

  const metadata = asRecord(record.metadata) ?? undefined;

  return {
    id,
    type: normalizeEventType(record.type),
    message,
    timestamp: asString(record.timestamp) ?? new Date(0).toISOString(),
    level: normalizeEventLevel(asOptionalString(record.level), normalizeEventType(record.type), metadata),
    metadata
  };
}

function mapList<T>(list: unknown, mapper: (value: unknown) => T | null): T[] {
  if (!Array.isArray(list)) return [];
  return list.map((item) => mapper(item)).filter((item): item is T => item !== null);
}

function toOverview(snapshot: Pick<RuntimeSnapshot, 'agents' | 'tasks' | 'events'>): Overview {
  const agentsByStatus: Overview['agentsByStatus'] = { idle: 0, busy: 0, offline: 0 };
  snapshot.agents.forEach((agent) => {
    agentsByStatus[agent.status] += 1;
  });

  const tasksByStatus: Overview['tasksByStatus'] = { todo: 0, in_progress: 0, blocked: 0, done: 0 };
  snapshot.tasks.forEach((task) => {
    tasksByStatus[task.status] += 1;
  });

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      agents: snapshot.agents.length,
      tasks: snapshot.tasks.length,
      events: snapshot.events.length,
      activeAgents: snapshot.agents.filter((agent) => agent.status === 'busy').length,
      openTasks: snapshot.tasks.filter((task) => task.status !== 'done').length
    },
    agentsByStatus,
    tasksByStatus
  };
}

function mapRawSnapshot(payload: unknown): RuntimeSnapshot {
  const record = asRecord(payload);
  const agents = mapList(record?.agents, mapAgent);
  const tasks = mapList(record?.tasks, mapTask);
  const events = mapList(record?.events, mapEvent);

  return {
    overview: toOverview({ agents, tasks, events }),
    agents,
    tasks,
    events
  };
}

export class OpenClawTransportRuntimeClient implements OpenClawRuntimeClient {
  constructor(private readonly transport: OpenClawRuntimeTransport) {}

  private success<T>(data: T): RuntimeResult<T> {
    return { ok: true, data };
  }

  private unavailable(error: unknown, operation: string): RuntimeResult<never> {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, code: 'UNAVAILABLE', message: `OpenClaw transport failed at ${operation}: ${message}` };
  }

  private mappedAgentOrNull(payload: unknown): Agent | null {
    return mapAgent(payload);
  }

  private mappedTaskOrNull(payload: unknown): Task | null {
    return mapTask(payload);
  }

  private mappedEventOrNull(payload: unknown): Event | null {
    return mapEvent(payload);
  }

  fetchSnapshot(): RuntimeSnapshotResult {
    try {
      return this.success(mapRawSnapshot(this.transport.fetchSnapshot()));
    } catch (error) {
      return this.unavailable(error, 'fetchSnapshot');
    }
  }

  listAgents(): RuntimeResult<Agent[]> {
    try {
      return this.success(mapList(this.transport.listAgents(), (value) => this.mappedAgentOrNull(value)));
    } catch (error) {
      return this.unavailable(error, 'listAgents');
    }
  }

  getAgent(agentId: string): RuntimeResult<Agent | null> {
    try {
      return this.success(this.mappedAgentOrNull(this.transport.getAgent(agentId)));
    } catch (error) {
      return this.unavailable(error, 'getAgent');
    }
  }

  controlAgent(action: OpenClawControlAgentAction, agentId: string): RuntimeResult<Agent | null> {
    try {
      return this.success(this.mappedAgentOrNull(this.transport.controlAgent(action, agentId)));
    } catch (error) {
      return this.unavailable(error, 'controlAgent');
    }
  }

  addAgent(payload: Pick<Agent, 'name' | 'role'> & Partial<Pick<Agent, 'status'>>): RuntimeResult<Agent> {
    try {
      const created = this.mappedAgentOrNull(this.transport.addAgent(payload));
      if (!created) {
        return { ok: false, code: 'UNAVAILABLE', message: 'OpenClaw transport returned malformed agent payload for addAgent.' };
      }
      return this.success(created);
    } catch (error) {
      return this.unavailable(error, 'addAgent');
    }
  }

  listTasks(): RuntimeResult<Task[]> {
    try {
      return this.success(mapList(this.transport.listTasks(), (value) => this.mappedTaskOrNull(value)));
    } catch (error) {
      return this.unavailable(error, 'listTasks');
    }
  }

  getTask(taskId: string): RuntimeResult<Task | null> {
    try {
      return this.success(this.mappedTaskOrNull(this.transport.getTask(taskId)));
    } catch (error) {
      return this.unavailable(error, 'getTask');
    }
  }

  controlTask(action: OpenClawControlTaskAction, taskId: string, status?: TaskStatus): RuntimeResult<Task | null> {
    try {
      return this.success(this.mappedTaskOrNull(this.transport.controlTask(action, taskId, status)));
    } catch (error) {
      return this.unavailable(error, 'controlTask');
    }
  }

  addTask(payload: Pick<Task, 'title' | 'priority'> & Partial<Omit<Task, 'id' | 'title' | 'priority' | 'createdAt' | 'updatedAt'>>): RuntimeResult<Task> {
    try {
      const created = this.mappedTaskOrNull(this.transport.addTask(payload));
      if (!created) {
        return { ok: false, code: 'UNAVAILABLE', message: 'OpenClaw transport returned malformed task payload for addTask.' };
      }
      return this.success(created);
    } catch (error) {
      return this.unavailable(error, 'addTask');
    }
  }

  listEvents(limit?: number): RuntimeResult<Event[]> {
    try {
      return this.success(mapList(this.transport.listEvents(limit), (value) => this.mappedEventOrNull(value)));
    } catch (error) {
      return this.unavailable(error, 'listEvents');
    }
  }

  subscribe(listener: (payload: { snapshot: RuntimeSnapshot; event?: Event }) => void): () => void {
    return this.transport.subscribe((payload: OpenClawRuntimeRawEventEnvelope) => {
      const snapshot = mapRawSnapshot(payload.snapshot);
      const event = this.mappedEventOrNull(payload.event) ?? undefined;
      listener({ snapshot, event });
    });
  }
}

export class OpenClawStubRuntimeClient implements OpenClawRuntimeClient {
  constructor(private readonly reason: RuntimeNotConfiguredReason = 'client-unavailable') {}

  private notConfigured(operation: string): RuntimeResult<never> {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      reason: this.reason,
      message: `OpenClaw runtime client is not configured for ${operation}.`
    };
  }

  fetchSnapshot(): RuntimeSnapshotResult {
    return this.notConfigured('fetchSnapshot');
  }

  listAgents(): RuntimeResult<Agent[]> {
    return this.notConfigured('listAgents');
  }

  getAgent(): RuntimeResult<Agent | null> {
    return this.notConfigured('getAgent');
  }

  controlAgent(): RuntimeResult<Agent | null> {
    return this.notConfigured('controlAgent');
  }

  addAgent(): RuntimeResult<Agent> {
    return this.notConfigured('addAgent');
  }

  listTasks(): RuntimeResult<Task[]> {
    return this.notConfigured('listTasks');
  }

  getTask(): RuntimeResult<Task | null> {
    return this.notConfigured('getTask');
  }

  controlTask(): RuntimeResult<Task | null> {
    return this.notConfigured('controlTask');
  }

  addTask(): RuntimeResult<Task> {
    return this.notConfigured('addTask');
  }

  listEvents(): RuntimeResult<Event[]> {
    return this.notConfigured('listEvents');
  }

  subscribe(): () => void {
    return () => {
      // no-op in not-configured mode
    };
  }
}

export class RuntimeSourceUnavailableError extends Error {
  constructor(
    readonly code: 'RUNTIME_NOT_CONFIGURED' | 'RUNTIME_UNAVAILABLE',
    message: string,
    readonly reason?: RuntimeNotConfiguredReason
  ) {
    super(message);
    this.name = 'RuntimeSourceUnavailableError';
  }
}

export interface OpenClawRuntimeSourceOptions {
  client?: OpenClawRuntimeClient;
  fallback: RuntimeSource;
  allowFallback?: boolean;
}

export class OpenClawRuntimeSource implements RuntimeSource {
  private readonly client: OpenClawRuntimeClient;
  private readonly fallback: RuntimeSource;
  private readonly allowFallback: boolean;

  constructor(options: OpenClawRuntimeSourceOptions) {
    this.client = options.client ?? new OpenClawStubRuntimeClient();
    this.fallback = options.fallback;
    this.allowFallback = options.allowFallback ?? false;
  }

  private unavailable(message: string, reason?: RuntimeNotConfiguredReason): never {
    throw new RuntimeSourceUnavailableError('RUNTIME_NOT_CONFIGURED', `[RUNTIME_NOT_CONFIGURED] ${message}`, reason);
  }

  private unavailableFromResult(
    result: Extract<RuntimeResult<unknown>, { ok: false }>,
    operation: string
  ): never {
    const detail = `${result.message} (operation=${operation})`;
    if (result.code === 'NOT_CONFIGURED') {
      return this.unavailable(detail, result.reason);
    }

    throw new RuntimeSourceUnavailableError('RUNTIME_UNAVAILABLE', `[RUNTIME_UNAVAILABLE] ${detail}`);
  }

  private withFallback<T>(operation: string, resolver: () => RuntimeResult<T>, fallback: () => T): T {
    const result = resolver();
    if (result.ok) {
      return result.data;
    }

    if (!this.allowFallback) {
      return this.unavailableFromResult(result, operation);
    }

    console.warn(`[runtime][openclaw] ${operation} fell back to mock runtime: ${result.message}`);
    return fallback();
  }

  getOverview(): Overview {
    return this.getSnapshot().overview;
  }

  getSnapshot(): RuntimeSnapshot {
    return this.withFallback('fetchSnapshot', () => this.client.fetchSnapshot(), () => this.fallback.getSnapshot());
  }

  listAgents(): Agent[] {
    return this.withFallback('listAgents', () => this.client.listAgents(), () => this.fallback.listAgents());
  }

  listTasks(): Task[] {
    return this.withFallback('listTasks', () => this.client.listTasks(), () => this.fallback.listTasks());
  }

  listEvents(limit?: number): Event[] {
    return this.withFallback('listEvents', () => this.client.listEvents(limit), () => this.fallback.listEvents(limit));
  }

  addAgent(payload: Pick<Agent, 'name' | 'role'> & Partial<Pick<Agent, 'status'>>): Agent {
    return this.withFallback('addAgent', () => this.client.addAgent(payload), () => this.fallback.addAgent(payload));
  }

  pauseAgent(agentId: string): Agent | undefined {
    const value = this.withFallback(
      'pauseAgent',
      () => this.client.controlAgent('pause', agentId),
      () => this.fallback.pauseAgent(agentId) ?? null
    );
    return value ?? undefined;
  }

  resumeAgent(agentId: string): Agent | undefined {
    const value = this.withFallback(
      'resumeAgent',
      () => this.client.controlAgent('resume', agentId),
      () => this.fallback.resumeAgent(agentId) ?? null
    );
    return value ?? undefined;
  }

  addTask(payload: Pick<Task, 'title' | 'priority'> & Partial<Omit<Task, 'id' | 'title' | 'priority' | 'createdAt' | 'updatedAt'>>): Task {
    return this.withFallback('addTask', () => this.client.addTask(payload), () => this.fallback.addTask(payload));
  }

  updateTaskStatus(taskId: string, status: TaskStatus): Task | undefined {
    const value = this.withFallback(
      'updateTaskStatus',
      () => this.client.controlTask('update_status', taskId, status),
      () => this.fallback.updateTaskStatus(taskId, status) ?? null
    );
    return value ?? undefined;
  }

  retryTask(taskId: string): Task | undefined {
    const value = this.withFallback(
      'retryTask',
      () => this.client.controlTask('retry', taskId),
      () => this.fallback.retryTask(taskId) ?? null
    );
    return value ?? undefined;
  }

  onStateChange(listener: (payload: { snapshot: RuntimeSnapshot; event?: Event }) => void): () => void {
    if (this.allowFallback) {
      return this.fallback.onStateChange(listener);
    }

    return this.client.subscribe(listener);
  }

  updateRandomState(): Event {
    if (this.allowFallback) {
      return this.fallback.updateRandomState();
    }

    return {
      id: `system-${Date.now()}`,
      type: 'system',
      level: 'warning',
      timestamp: new Date().toISOString(),
      message: '[RUNTIME_NOT_CONFIGURED] OpenClaw runtime is not configured. Connect adapter credentials/endpoint or set ALLOW_RUNTIME_FALLBACK=true for mock fallback.'
    };
  }
}
