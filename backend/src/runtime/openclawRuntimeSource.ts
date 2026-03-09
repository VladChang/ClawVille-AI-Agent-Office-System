import { Agent, AgentStatus, Event, EventType, Overview, Task, TaskStatus, normalizeEventLevel } from '../models/types';
import { RuntimeSnapshot, RuntimeSource } from './runtimeSource';
import { OpenClawRuntimeRawEventEnvelope, OpenClawRuntimeTransport } from './openclawTransport';

export type OpenClawControlAgentAction = 'pause' | 'resume';
export type OpenClawControlTaskAction = 'retry' | 'update_status';

export interface OpenClawRuntimeClient {
  readonly configured: boolean;
  fetchSnapshot(): Promise<RuntimeSnapshotResult>;
  listAgents(): Promise<RuntimeResult<Agent[]>>;
  getAgent(agentId: string): Promise<RuntimeResult<Agent | null>>;
  controlAgent(action: OpenClawControlAgentAction, agentId: string): Promise<RuntimeResult<Agent | null>>;
  updateAgentDisplayName(agentId: string, displayName: string | null): Promise<RuntimeResult<Agent | null>>;
  addAgent(payload: Pick<Agent, 'name' | 'role'> & Partial<Pick<Agent, 'status'>>): Promise<RuntimeResult<Agent>>;

  listTasks(): Promise<RuntimeResult<Task[]>>;
  getTask(taskId: string): Promise<RuntimeResult<Task | null>>;
  controlTask(action: OpenClawControlTaskAction, taskId: string, status?: TaskStatus): Promise<RuntimeResult<Task | null>>;
  addTask(payload: Pick<Task, 'title' | 'priority'> & Partial<Omit<Task, 'id' | 'title' | 'priority' | 'createdAt' | 'updatedAt'>>): Promise<RuntimeResult<Task>>;

  listEvents(limit?: number): Promise<RuntimeResult<Event[]>>;
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
    displayName: asOptionalString(record.displayName),
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
  readonly configured = true;

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

  async fetchSnapshot(): Promise<RuntimeSnapshotResult> {
    try {
      return this.success(mapRawSnapshot(await this.transport.fetchSnapshot()));
    } catch (error) {
      return this.unavailable(error, 'fetchSnapshot');
    }
  }

  async listAgents(): Promise<RuntimeResult<Agent[]>> {
    try {
      return this.success(mapList(await this.transport.listAgents(), (value) => this.mappedAgentOrNull(value)));
    } catch (error) {
      return this.unavailable(error, 'listAgents');
    }
  }

  async getAgent(agentId: string): Promise<RuntimeResult<Agent | null>> {
    try {
      return this.success(this.mappedAgentOrNull(await this.transport.getAgent(agentId)));
    } catch (error) {
      return this.unavailable(error, 'getAgent');
    }
  }

  async controlAgent(action: OpenClawControlAgentAction, agentId: string): Promise<RuntimeResult<Agent | null>> {
    try {
      return this.success(this.mappedAgentOrNull(await this.transport.controlAgent(action, agentId)));
    } catch (error) {
      return this.unavailable(error, 'controlAgent');
    }
  }

  async updateAgentDisplayName(agentId: string, displayName: string | null): Promise<RuntimeResult<Agent | null>> {
    try {
      return this.success(this.mappedAgentOrNull(await this.transport.updateAgentDisplayName(agentId, displayName)));
    } catch (error) {
      return this.unavailable(error, 'updateAgentDisplayName');
    }
  }

  async addAgent(payload: Pick<Agent, 'name' | 'role'> & Partial<Pick<Agent, 'status'>>): Promise<RuntimeResult<Agent>> {
    try {
      const created = this.mappedAgentOrNull(await this.transport.addAgent(payload));
      if (!created) {
        return { ok: false, code: 'UNAVAILABLE', message: 'OpenClaw transport returned malformed agent payload for addAgent.' };
      }
      return this.success(created);
    } catch (error) {
      return this.unavailable(error, 'addAgent');
    }
  }

  async listTasks(): Promise<RuntimeResult<Task[]>> {
    try {
      return this.success(mapList(await this.transport.listTasks(), (value) => this.mappedTaskOrNull(value)));
    } catch (error) {
      return this.unavailable(error, 'listTasks');
    }
  }

  async getTask(taskId: string): Promise<RuntimeResult<Task | null>> {
    try {
      return this.success(this.mappedTaskOrNull(await this.transport.getTask(taskId)));
    } catch (error) {
      return this.unavailable(error, 'getTask');
    }
  }

  async controlTask(action: OpenClawControlTaskAction, taskId: string, status?: TaskStatus): Promise<RuntimeResult<Task | null>> {
    try {
      return this.success(this.mappedTaskOrNull(await this.transport.controlTask(action, taskId, status)));
    } catch (error) {
      return this.unavailable(error, 'controlTask');
    }
  }

  async addTask(payload: Pick<Task, 'title' | 'priority'> & Partial<Omit<Task, 'id' | 'title' | 'priority' | 'createdAt' | 'updatedAt'>>): Promise<RuntimeResult<Task>> {
    try {
      const created = this.mappedTaskOrNull(await this.transport.addTask(payload));
      if (!created) {
        return { ok: false, code: 'UNAVAILABLE', message: 'OpenClaw transport returned malformed task payload for addTask.' };
      }
      return this.success(created);
    } catch (error) {
      return this.unavailable(error, 'addTask');
    }
  }

  async listEvents(limit?: number): Promise<RuntimeResult<Event[]>> {
    try {
      return this.success(mapList(await this.transport.listEvents(limit), (value) => this.mappedEventOrNull(value)));
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
  readonly configured = false;

  constructor(private readonly reason: RuntimeNotConfiguredReason = 'client-unavailable') {}

  private notConfigured(operation: string): RuntimeResult<never> {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      reason: this.reason,
      message: `OpenClaw runtime client is not configured for ${operation}.`
    };
  }

  async fetchSnapshot(): Promise<RuntimeSnapshotResult> {
    return this.notConfigured('fetchSnapshot');
  }

  async listAgents(): Promise<RuntimeResult<Agent[]>> {
    return this.notConfigured('listAgents');
  }

  async getAgent(): Promise<RuntimeResult<Agent | null>> {
    return this.notConfigured('getAgent');
  }

  async controlAgent(): Promise<RuntimeResult<Agent | null>> {
    return this.notConfigured('controlAgent');
  }

  async updateAgentDisplayName(): Promise<RuntimeResult<Agent | null>> {
    return this.notConfigured('updateAgentDisplayName');
  }

  async addAgent(): Promise<RuntimeResult<Agent>> {
    return this.notConfigured('addAgent');
  }

  async listTasks(): Promise<RuntimeResult<Task[]>> {
    return this.notConfigured('listTasks');
  }

  async getTask(): Promise<RuntimeResult<Task | null>> {
    return this.notConfigured('getTask');
  }

  async controlTask(): Promise<RuntimeResult<Task | null>> {
    return this.notConfigured('controlTask');
  }

  async addTask(): Promise<RuntimeResult<Task>> {
    return this.notConfigured('addTask');
  }

  async listEvents(): Promise<RuntimeResult<Event[]>> {
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

  private async withFallback<T>(operation: string, resolver: () => Promise<RuntimeResult<T>>, fallback: () => Promise<T>): Promise<T> {
    const result = await resolver();
    if (result.ok) {
      return result.data;
    }

    if (!this.allowFallback) {
      return this.unavailableFromResult(result, operation);
    }

    console.warn(`[runtime][openclaw] ${operation} fell back to mock runtime: ${result.message}`);
    return fallback();
  }

  async getOverview(): Promise<Overview> {
    return (await this.getSnapshot()).overview;
  }

  async getSnapshot(): Promise<RuntimeSnapshot> {
    return this.withFallback('fetchSnapshot', () => this.client.fetchSnapshot(), () => this.fallback.getSnapshot());
  }

  async listAgents(): Promise<Agent[]> {
    return this.withFallback('listAgents', () => this.client.listAgents(), () => this.fallback.listAgents());
  }

  async listTasks(): Promise<Task[]> {
    return this.withFallback('listTasks', () => this.client.listTasks(), () => this.fallback.listTasks());
  }

  async listEvents(limit?: number): Promise<Event[]> {
    return this.withFallback('listEvents', () => this.client.listEvents(limit), () => this.fallback.listEvents(limit));
  }

  async addAgent(payload: Pick<Agent, 'name' | 'role'> & Partial<Pick<Agent, 'status'>>): Promise<Agent> {
    return this.withFallback('addAgent', () => this.client.addAgent(payload), () => this.fallback.addAgent(payload));
  }

  async pauseAgent(agentId: string): Promise<Agent | undefined> {
    const value = await this.withFallback(
      'pauseAgent',
      () => this.client.controlAgent('pause', agentId),
      async () => (await this.fallback.pauseAgent(agentId)) ?? null
    );
    return value ?? undefined;
  }

  async resumeAgent(agentId: string): Promise<Agent | undefined> {
    const value = await this.withFallback(
      'resumeAgent',
      () => this.client.controlAgent('resume', agentId),
      async () => (await this.fallback.resumeAgent(agentId)) ?? null
    );
    return value ?? undefined;
  }

  async updateAgentDisplayName(agentId: string, displayName: string | null): Promise<Agent | undefined> {
    const value = await this.withFallback(
      'updateAgentDisplayName',
      () => this.client.updateAgentDisplayName(agentId, displayName),
      async () => (await this.fallback.updateAgentDisplayName(agentId, displayName)) ?? null
    );
    return value ?? undefined;
  }

  async addTask(
    payload: Pick<Task, 'title' | 'priority'> & Partial<Omit<Task, 'id' | 'title' | 'priority' | 'createdAt' | 'updatedAt'>>
  ): Promise<Task> {
    return this.withFallback('addTask', () => this.client.addTask(payload), () => this.fallback.addTask(payload));
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task | undefined> {
    const value = await this.withFallback(
      'updateTaskStatus',
      () => this.client.controlTask('update_status', taskId, status),
      async () => (await this.fallback.updateTaskStatus(taskId, status)) ?? null
    );
    return value ?? undefined;
  }

  async retryTask(taskId: string): Promise<Task | undefined> {
    const value = await this.withFallback(
      'retryTask',
      () => this.client.controlTask('retry', taskId),
      async () => (await this.fallback.retryTask(taskId)) ?? null
    );
    return value ?? undefined;
  }

  onStateChange(listener: (payload: { snapshot: RuntimeSnapshot; event?: Event }) => void): () => void {
    if (this.allowFallback && !this.client.configured) {
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
