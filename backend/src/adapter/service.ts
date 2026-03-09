import { randomUUID } from 'node:crypto';
import {
  Agent,
  Event,
  Overview,
  RuntimeSnapshot,
  Task,
  TaskPriority,
  normalizeAgentStatus,
  normalizeEventLevel,
  normalizeTaskStatus
} from '../models/types';
import { OpenClawAliasStore } from './aliasStore';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickString(record: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!record) return undefined;

  for (const key of keys) {
    const value = asString(record[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function pickTimestamp(record: Record<string, unknown> | null, keys: string[], fallback: string): string {
  return pickString(record, keys) ?? fallback;
}

function pickNestedId(record: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!record) return undefined;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    const nested = asRecord(value);
    const id = asString(nested?.id);
    if (id) {
      return id;
    }
  }

  return undefined;
}

function mapAgentStatus(value: unknown): Agent['status'] {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  if (raw.includes('offline') || raw.includes('pause') || raw.includes('stop') || raw.includes('disconnect') || raw.includes('error')) {
    return 'offline';
  }
  if (raw.includes('idle') || raw.includes('ready') || raw.includes('waiting') || raw.includes('available') || raw.includes('standby')) {
    return 'idle';
  }
  if (raw.includes('busy') || raw.includes('run') || raw.includes('work') || raw.includes('active') || raw.includes('process')) {
    return 'busy';
  }

  return normalizeAgentStatus(asString(value));
}

function mapTaskStatus(value: unknown): Task['status'] {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  if (raw.includes('block') || raw.includes('stalled') || raw.includes('dependency') || raw.includes('error')) {
    return 'blocked';
  }
  if (raw.includes('done') || raw.includes('complete') || raw.includes('success') || raw.includes('finish')) {
    return 'done';
  }
  if (raw.includes('progress') || raw.includes('running') || raw.includes('active') || raw.includes('execut')) {
    return 'in_progress';
  }
  if (raw.includes('queue') || raw.includes('pending') || raw.includes('todo') || raw.includes('new')) {
    return 'todo';
  }

  return normalizeTaskStatus(asString(value));
}

function mapTaskPriority(value: unknown): TaskPriority {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  if (raw.includes('critical') || raw.includes('urgent') || raw.includes('high')) return 'high';
  if (raw.includes('low') || raw.includes('minor')) return 'low';
  return 'medium';
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function substitutePathTemplate(template: string, id: string): string {
  return template.replace(/:id\b/g, encodeURIComponent(id));
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function unwrapPayload(payload: unknown): unknown {
  const record = asRecord(payload);
  if (record?.success === true && 'data' in record) {
    return unwrapPayload(record.data);
  }

  return payload;
}

function extractArrayPayload(payload: unknown, keys: string[]): unknown[] {
  const unwrapped = unwrapPayload(payload);
  if (Array.isArray(unwrapped)) {
    return unwrapped;
  }

  const record = asRecord(unwrapped);
  if (!record) {
    return [];
  }

  for (const key of keys) {
    const list = record[key];
    if (Array.isArray(list)) {
      return list;
    }
  }

  return [];
}

function mergeMetadata(record: Record<string, unknown>): Record<string, unknown> | undefined {
  const metadata = asRecord(record.metadata) ?? {};
  const agentId = pickString(record, ['agentId', 'workerId']);
  const taskId = pickString(record, ['taskId', 'jobId']);
  const status = pickString(record, ['status', 'state']);

  const merged: Record<string, unknown> = { ...metadata };
  if (agentId) merged.agentId = agentId;
  if (taskId) merged.taskId = taskId;
  if (status) merged.status = status;

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function sortEventsDesc(events: Event[]): Event[] {
  return [...events].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
}

function toOverview(agents: Agent[], tasks: Task[], events: Event[]): Overview {
  const agentsByStatus: Overview['agentsByStatus'] = { idle: 0, busy: 0, offline: 0 };
  const tasksByStatus: Overview['tasksByStatus'] = { todo: 0, in_progress: 0, blocked: 0, done: 0 };

  for (const agent of agents) {
    agentsByStatus[agent.status] += 1;
  }

  for (const task of tasks) {
    tasksByStatus[task.status] += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      agents: agents.length,
      tasks: tasks.length,
      events: events.length,
      activeAgents: agents.filter((agent) => agent.status === 'busy').length,
      openTasks: tasks.filter((task) => task.status !== 'done').length
    },
    agentsByStatus,
    tasksByStatus
  };
}

function normalizeAgentRecord(payload: unknown): Agent | null {
  const record = asRecord(payload);
  if (!record) return null;

  const id = pickString(record, ['id', 'agentId', 'workerId', 'uuid']);
  const name = pickString(record, ['name', 'agentName', 'workerName', 'label', 'title']);
  const role = pickString(record, ['role', 'agentRole', 'type', 'kind', 'profile']) ?? 'OpenClaw Agent';
  if (!id || !name) return null;

  const fallbackTimestamp = new Date(0).toISOString();
  const displayName = pickString(record, ['displayName', 'alias']);

  return {
    id,
    name,
    displayName,
    role,
    status: mapAgentStatus(record.status ?? record.state ?? record.mode),
    updatedAt: pickTimestamp(record, ['updatedAt', 'lastUpdatedAt', 'lastSeenAt', 'timestamp', 'ts', 'createdAt'], fallbackTimestamp)
  };
}

function normalizeTaskRecord(payload: unknown): Task | null {
  const record = asRecord(payload);
  if (!record) return null;

  const id = pickString(record, ['id', 'taskId', 'jobId', 'runId', 'ticketId']);
  const title = pickString(record, ['title', 'name', 'taskName', 'jobName', 'summary']);
  if (!id || !title) return null;

  const createdAt = pickTimestamp(record, ['createdAt', 'queuedAt', 'submittedAt', 'timestamp', 'ts'], new Date(0).toISOString());

  return {
    id,
    title,
    description: pickString(record, ['description', 'details', 'summary']),
    assigneeAgentId: pickNestedId(record, ['assigneeAgentId', 'agentId', 'ownerId', 'workerId', 'assignee', 'owner']),
    status: mapTaskStatus(record.status ?? record.state),
    priority: mapTaskPriority(record.priority ?? record.severity ?? record.importance),
    createdAt,
    updatedAt: pickTimestamp(record, ['updatedAt', 'lastUpdatedAt', 'timestamp', 'ts', 'createdAt'], createdAt)
  };
}

function normalizeEventRecord(payload: unknown): Event | null {
  const record = asRecord(payload);
  if (!record) return null;

  const timestamp = pickTimestamp(record, ['timestamp', 'occurredAt', 'createdAt', 'updatedAt', 'ts'], new Date().toISOString());
  const type = pickString(record, ['type', 'kind', 'eventType', 'name']) ?? 'system';
  const message = pickString(record, ['message', 'summary', 'description', 'title', 'text']);
  if (!message) return null;

  const metadata = mergeMetadata(record);
  const id = pickString(record, ['id', 'eventId', 'uuid']) ?? `oc-adapter-event-${timestamp}-${type}`;

  return {
    id,
    type,
    message,
    timestamp,
    level: normalizeEventLevel(pickString(record, ['level', 'severity']), type, metadata),
    metadata
  };
}

function normalizeSnapshotPayload(payload: unknown): { agents: unknown[]; tasks: unknown[]; events: unknown[] } {
  const unwrapped = unwrapPayload(payload);
  const record = asRecord(unwrapped);
  const snapshot = asRecord(record?.snapshot) ?? record;

  return {
    agents: asArray(snapshot?.agents),
    tasks: asArray(snapshot?.tasks),
    events: asArray(snapshot?.events)
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export class OpenClawAdapterUnavailableError extends Error {
  constructor(
    readonly code: 'UPSTREAM_NOT_CONFIGURED' | 'UPSTREAM_UNAVAILABLE',
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = 'OpenClawAdapterUnavailableError';
  }
}

interface OpenClawInternalClientOptions {
  baseUrl?: string;
  apiKey?: string;
  authHeaderName?: string;
  authScheme?: string;
  healthPath?: string;
  snapshotPath?: string;
  agentsPath?: string;
  tasksPath?: string;
  eventsPath?: string;
  agentPausePathTemplate?: string;
  agentResumePathTemplate?: string;
  taskRetryPathTemplate?: string;
  requestTimeoutMs?: number;
}

export class OpenClawInternalClient {
  private readonly baseUrl?: string;
  private readonly apiKey?: string;
  private readonly authHeaderName: string;
  private readonly authScheme: string;
  private readonly healthPath: string;
  private readonly snapshotPath: string;
  private readonly agentsPath: string;
  private readonly tasksPath: string;
  private readonly eventsPath: string;
  private readonly agentPausePathTemplate: string;
  private readonly agentResumePathTemplate: string;
  private readonly taskRetryPathTemplate: string;
  private readonly requestTimeoutMs: number;

  constructor(options: OpenClawInternalClientOptions) {
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
    this.authHeaderName = options.authHeaderName ?? 'authorization';
    this.authScheme = options.authScheme ?? 'Bearer';
    this.healthPath = options.healthPath ?? '/health';
    this.snapshotPath = options.snapshotPath ?? '/snapshot';
    this.agentsPath = options.agentsPath ?? '/agents';
    this.tasksPath = options.tasksPath ?? '/tasks';
    this.eventsPath = options.eventsPath ?? '/events';
    this.agentPausePathTemplate = options.agentPausePathTemplate ?? '/agents/:id/pause';
    this.agentResumePathTemplate = options.agentResumePathTemplate ?? '/agents/:id/resume';
    this.taskRetryPathTemplate = options.taskRetryPathTemplate ?? '/tasks/:id/retry';
    this.requestTimeoutMs = options.requestTimeoutMs ?? 5000;
  }

  get configured(): boolean {
    return Boolean(this.baseUrl);
  }

  private requireConfigured(): string {
    if (!this.baseUrl) {
      throw new OpenClawAdapterUnavailableError(
        'UPSTREAM_NOT_CONFIGURED',
        'OpenClaw internal upstream is not configured. Set OPENCLAW_INTERNAL_BASE_URL for the adapter service.',
        503
      );
    }

    return this.baseUrl;
  }

  private buildUrl(pathname: string): URL {
    const baseUrl = this.requireConfigured();

    return isAbsoluteHttpUrl(pathname)
      ? new URL(pathname)
      : new URL(trimSlashes(pathname), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  }

  private headers(body?: unknown): HeadersInit {
    const headers: Record<string, string> = {
      Accept: 'application/json'
    };

    if (this.apiKey && this.apiKey.trim().length > 0) {
      headers[this.authHeaderName] = this.authScheme.length > 0 ? `${this.authScheme} ${this.apiKey}` : this.apiKey;
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  private async request(
    pathname: string,
    init: Omit<RequestInit, 'headers' | 'body'> & { body?: unknown } = {},
    options: { allowNotFound?: boolean } = {}
  ): Promise<unknown | null> {
    const { body, signal, ...requestInit } = init;
    const controller = new AbortController();
    let timedOut = false;

    const abortFromUpstreamSignal = () => {
      controller.abort(signal?.reason);
    };

    if (signal?.aborted) {
      abortFromUpstreamSignal();
    } else {
      signal?.addEventListener('abort', abortFromUpstreamSignal, { once: true });
    }

    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.requestTimeoutMs);

    try {
      const response = await fetch(this.buildUrl(pathname), {
        ...requestInit,
        signal: controller.signal,
        headers: this.headers(body),
        body: body === undefined ? undefined : JSON.stringify(body)
      });

      if (options.allowNotFound && response.status === 404) {
        return null;
      }

      const text = await response.text();
      let payload: unknown = null;

      if (text.trim().length > 0) {
        try {
          payload = JSON.parse(text) as unknown;
        } catch {
          throw new OpenClawAdapterUnavailableError(
            'UPSTREAM_UNAVAILABLE',
            `OpenClaw internal upstream returned invalid JSON for ${pathname}.`,
            502
          );
        }
      }

      if (!response.ok) {
        const message =
          asString(asRecord(asRecord(payload)?.error)?.message) ??
          asString(asRecord(payload)?.message) ??
          `OpenClaw internal upstream request failed with status ${response.status}.`;
        throw new OpenClawAdapterUnavailableError('UPSTREAM_UNAVAILABLE', message, response.status >= 500 ? 502 : response.status);
      }

      return unwrapPayload(payload);
    } catch (error) {
      if (error instanceof OpenClawAdapterUnavailableError) {
        throw error;
      }

      if (timedOut) {
        throw new OpenClawAdapterUnavailableError(
          'UPSTREAM_UNAVAILABLE',
          `OpenClaw internal upstream request to ${pathname} timed out after ${this.requestTimeoutMs}ms.`,
          504
        );
      }

      throw new OpenClawAdapterUnavailableError(
        'UPSTREAM_UNAVAILABLE',
        error instanceof Error ? error.message : String(error),
        502
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortFromUpstreamSignal);
    }
  }

  async health(): Promise<boolean> {
    try {
      await this.request(this.healthPath, { method: 'GET' }, { allowNotFound: true });
      return true;
    } catch (error) {
      if (error instanceof OpenClawAdapterUnavailableError && error.code === 'UPSTREAM_NOT_CONFIGURED') {
        return false;
      }
      return false;
    }
  }

  async fetchSnapshot(): Promise<unknown | null> {
    return this.request(this.snapshotPath, { method: 'GET' }, { allowNotFound: true });
  }

  async listAgents(): Promise<unknown[]> {
    const payload = await this.request(this.agentsPath, { method: 'GET' }, { allowNotFound: true });
    return payload === null ? [] : extractArrayPayload(payload, ['agents', 'items', 'workers']);
  }

  async listTasks(): Promise<unknown[]> {
    const payload = await this.request(this.tasksPath, { method: 'GET' }, { allowNotFound: true });
    return payload === null ? [] : extractArrayPayload(payload, ['tasks', 'items', 'jobs']);
  }

  async listEvents(): Promise<unknown[]> {
    const payload = await this.request(this.eventsPath, { method: 'GET' }, { allowNotFound: true });
    return payload === null ? [] : extractArrayPayload(payload, ['events', 'items']);
  }

  async pauseAgent(agentId: string): Promise<unknown | null> {
    return this.request(substitutePathTemplate(this.agentPausePathTemplate, agentId), { method: 'POST' }, { allowNotFound: true });
  }

  async resumeAgent(agentId: string): Promise<unknown | null> {
    return this.request(substitutePathTemplate(this.agentResumePathTemplate, agentId), { method: 'POST' }, { allowNotFound: true });
  }

  async retryTask(taskId: string): Promise<unknown | null> {
    return this.request(substitutePathTemplate(this.taskRetryPathTemplate, taskId), { method: 'POST' }, { allowNotFound: true });
  }
}

export interface AdapterHealthStatus {
  ok: true;
  configured: boolean;
  upstreamHealthy: boolean;
  ts: string;
}

export class OpenClawAdapterService {
  private readonly localEvents: Event[] = [];

  constructor(
    private readonly client: OpenClawInternalClient,
    private readonly aliasStore: OpenClawAliasStore,
    private readonly localEventLimit = 100
  ) {}

  private normalizeAgents(list: unknown[]): Agent[] {
    return list.map((item) => normalizeAgentRecord(item)).filter((item): item is Agent => item !== null);
  }

  private normalizeTasks(list: unknown[]): Task[] {
    return list.map((item) => normalizeTaskRecord(item)).filter((item): item is Task => item !== null);
  }

  private normalizeEvents(list: unknown[]): Event[] {
    return list.map((item) => normalizeEventRecord(item)).filter((item): item is Event => item !== null);
  }

  private async snapshotParts(): Promise<{ agents: Agent[]; tasks: Task[]; events: Event[] }> {
    const rawSnapshot = await this.client.fetchSnapshot();
    if (rawSnapshot) {
      const payload = normalizeSnapshotPayload(rawSnapshot);
      return {
        agents: await this.aliasStore.apply(this.normalizeAgents(payload.agents)),
        tasks: this.normalizeTasks(payload.tasks),
        events: sortEventsDesc([...this.localEvents, ...this.normalizeEvents(payload.events)])
      };
    }

    const [agents, tasks, events] = await Promise.all([this.listAgents(), this.listTasks(), this.listEvents()]);
    return { agents, tasks, events };
  }

  private async resolveAgentById(agentId: string): Promise<Agent | null> {
    const agents = await this.listAgents();
    return agents.find((agent) => agent.id === agentId) ?? null;
  }

  private async resolveTaskById(taskId: string): Promise<Task | null> {
    const tasks = await this.listTasks();
    return tasks.find((task) => task.id === taskId) ?? null;
  }

  private pushLocalEvent(event: Event): void {
    this.localEvents.unshift(event);
    if (this.localEvents.length > this.localEventLimit) {
      this.localEvents.length = this.localEventLimit;
    }
  }

  async health(): Promise<AdapterHealthStatus> {
    return {
      ok: true,
      configured: this.client.configured,
      upstreamHealthy: this.client.configured ? await this.client.health() : false,
      ts: new Date().toISOString()
    };
  }

  async getSnapshot(): Promise<RuntimeSnapshot> {
    const { agents, tasks, events } = await this.snapshotParts();
    return {
      overview: toOverview(agents, tasks, events),
      agents,
      tasks,
      events
    };
  }

  async listAgents(): Promise<Agent[]> {
    return this.aliasStore.apply(this.normalizeAgents(await this.client.listAgents()));
  }

  async listTasks(): Promise<Task[]> {
    return this.normalizeTasks(await this.client.listTasks());
  }

  async listEvents(limit?: number): Promise<Event[]> {
    const events = sortEventsDesc([...this.localEvents, ...this.normalizeEvents(await this.client.listEvents())]);
    if (typeof limit === 'number' && Number.isFinite(limit)) {
      return events.slice(0, Math.max(0, Math.floor(limit)));
    }

    return events;
  }

  async pauseAgent(agentId: string): Promise<Agent | null> {
    const payload = await this.client.pauseAgent(agentId);
    const normalized = normalizeAgentRecord(payload);
    if (normalized) {
      const [agent] = await this.aliasStore.apply([normalized]);
      return agent;
    }

    return this.resolveAgentById(agentId);
  }

  async resumeAgent(agentId: string): Promise<Agent | null> {
    const payload = await this.client.resumeAgent(agentId);
    const normalized = normalizeAgentRecord(payload);
    if (normalized) {
      const [agent] = await this.aliasStore.apply([normalized]);
      return agent;
    }

    return this.resolveAgentById(agentId);
  }

  async retryTask(taskId: string): Promise<Task | null> {
    const payload = await this.client.retryTask(taskId);
    const normalized = normalizeTaskRecord(payload);
    if (normalized) {
      return normalized;
    }

    return this.resolveTaskById(taskId);
  }

  async updateAgentDisplayName(agentId: string, displayName: string | null): Promise<Agent | null> {
    const agent = await this.resolveAgentById(agentId);
    if (!agent) {
      return null;
    }

    const nextDisplayName = await this.aliasStore.set(agentId, displayName);
    const updatedAgent: Agent = {
      ...agent,
      displayName: nextDisplayName,
      updatedAt: new Date().toISOString()
    };

    this.pushLocalEvent({
      id: randomUUID(),
      type: 'system',
      message: `已更新 Agent 顯示別名：${agent.name}`,
      timestamp: updatedAgent.updatedAt,
      level: 'info',
      metadata: {
        agentId,
        displayName: nextDisplayName ?? null
      }
    });

    return updatedAgent;
  }
}

export function createOpenClawAdapterServiceFromEnv(): OpenClawAdapterService {
  const client = new OpenClawInternalClient({
    baseUrl: process.env.OPENCLAW_INTERNAL_BASE_URL?.trim(),
    apiKey: process.env.OPENCLAW_INTERNAL_API_KEY?.trim(),
    authHeaderName: process.env.OPENCLAW_INTERNAL_AUTH_HEADER?.trim() || undefined,
    authScheme: process.env.OPENCLAW_INTERNAL_AUTH_SCHEME?.trim() || undefined,
    healthPath: process.env.OPENCLAW_INTERNAL_HEALTH_PATH?.trim() || undefined,
    snapshotPath: process.env.OPENCLAW_INTERNAL_SNAPSHOT_PATH?.trim() || undefined,
    agentsPath: process.env.OPENCLAW_INTERNAL_AGENTS_PATH?.trim() || undefined,
    tasksPath: process.env.OPENCLAW_INTERNAL_TASKS_PATH?.trim() || undefined,
    eventsPath: process.env.OPENCLAW_INTERNAL_EVENTS_PATH?.trim() || undefined,
    agentPausePathTemplate: process.env.OPENCLAW_INTERNAL_AGENT_PAUSE_PATH_TEMPLATE?.trim() || undefined,
    agentResumePathTemplate: process.env.OPENCLAW_INTERNAL_AGENT_RESUME_PATH_TEMPLATE?.trim() || undefined,
    taskRetryPathTemplate: process.env.OPENCLAW_INTERNAL_TASK_RETRY_PATH_TEMPLATE?.trim() || undefined,
    requestTimeoutMs: parsePositiveInteger(process.env.OPENCLAW_INTERNAL_REQUEST_TIMEOUT_MS, 5000)
  });
  const aliasStore = new OpenClawAliasStore(process.env.OPENCLAW_ADAPTER_ALIAS_FILE?.trim() || '.data/openclaw-agent-aliases.json');

  return new OpenClawAdapterService(client, aliasStore);
}
