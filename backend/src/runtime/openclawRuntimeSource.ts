import { Agent, Event, Overview, Task, TaskStatus } from '../models/types';
import { RuntimeSnapshot, RuntimeSource } from './runtimeSource';

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

  private mapSnapshot(snapshot: RuntimeSnapshot): RuntimeSnapshot {
    return {
      overview: snapshot.overview,
      agents: snapshot.agents,
      tasks: snapshot.tasks,
      events: snapshot.events
    };
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

    return this.client.subscribe((payload) => listener({ snapshot: this.mapSnapshot(payload.snapshot), event: payload.event }));
  }

  updateRandomState(): Event {
    if (this.allowFallback) {
      return this.fallback.updateRandomState();
    }

    return {
      id: `system-${Date.now()}`,
      type: 'system',
      timestamp: new Date().toISOString(),
      message: '[RUNTIME_NOT_CONFIGURED] OpenClaw runtime is not configured. Connect adapter credentials/endpoint or set ALLOW_RUNTIME_FALLBACK=true for mock fallback.'
    };
  }
}
