import { readFileSync } from 'node:fs';
import { AgentStatus, TaskStatus } from '../models/types';

export interface OpenClawRuntimeRawSnapshot {
  overview?: unknown;
  agents?: unknown;
  tasks?: unknown;
  events?: unknown;
}

export interface OpenClawRuntimeRawEventEnvelope {
  snapshot?: OpenClawRuntimeRawSnapshot;
  event?: unknown;
}

export interface OpenClawRuntimeTransport {
  fetchSnapshot(): Promise<OpenClawRuntimeRawSnapshot>;
  listAgents(): Promise<unknown[]>;
  getAgent(agentId: string): Promise<unknown | null>;
  controlAgent(action: 'pause' | 'resume', agentId: string): Promise<unknown | null>;
  addAgent(payload: { name: string; role: string; status?: AgentStatus }): Promise<unknown>;

  listTasks(): Promise<unknown[]>;
  getTask(taskId: string): Promise<unknown | null>;
  controlTask(action: 'retry' | 'update_status', taskId: string, status?: TaskStatus): Promise<unknown | null>;
  addTask(payload: {
    title: string;
    priority: 'low' | 'medium' | 'high';
    description?: string;
    assigneeAgentId?: string;
    status?: TaskStatus;
  }): Promise<unknown>;

  listEvents(limit?: number): Promise<unknown[]>;
  subscribe(listener: (payload: OpenClawRuntimeRawEventEnvelope) => void): () => void;
}

interface FixturePayload {
  snapshot?: OpenClawRuntimeRawSnapshot;
  agents?: unknown[];
  tasks?: unknown[];
  events?: unknown[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function loadFixtureFromEnv(): FixturePayload | null {
  const json = process.env.OPENCLAW_RUNTIME_FIXTURE_JSON;
  const path = process.env.OPENCLAW_RUNTIME_FIXTURE_PATH;

  if (!json && !path) return null;

  const raw = json ?? readFileSync(path as string, 'utf8');
  return JSON.parse(raw) as FixturePayload;
}

export class FixtureRuntimeTransport implements OpenClawRuntimeTransport {
  private readonly listeners = new Set<(payload: OpenClawRuntimeRawEventEnvelope) => void>();
  private readonly state: { agents: unknown[]; tasks: unknown[]; events: unknown[] };

  constructor(fixture: FixturePayload) {
    this.state = {
      agents: Array.isArray(fixture.agents) ? deepClone(fixture.agents) : Array.isArray(fixture.snapshot?.agents) ? deepClone(fixture.snapshot.agents) : [],
      tasks: Array.isArray(fixture.tasks) ? deepClone(fixture.tasks) : Array.isArray(fixture.snapshot?.tasks) ? deepClone(fixture.snapshot.tasks) : [],
      events: Array.isArray(fixture.events) ? deepClone(fixture.events) : Array.isArray(fixture.snapshot?.events) ? deepClone(fixture.snapshot.events) : []
    };
  }

  static fromEnv(): FixtureRuntimeTransport | null {
    const fixture = loadFixtureFromEnv();
    return fixture ? new FixtureRuntimeTransport(fixture) : null;
  }

  private emit(event?: unknown) {
    const payload: OpenClawRuntimeRawEventEnvelope = {
      snapshot: {
        agents: deepClone(this.state.agents),
        tasks: deepClone(this.state.tasks),
        events: deepClone(this.state.events)
      },
      event
    };

    this.listeners.forEach((listener) => listener(deepClone(payload)));
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  async fetchSnapshot(): Promise<OpenClawRuntimeRawSnapshot> {
    return {
      agents: deepClone(this.state.agents),
      tasks: deepClone(this.state.tasks),
      events: deepClone(this.state.events)
    };
  }

  async listAgents(): Promise<unknown[]> {
    return deepClone(this.state.agents);
  }

  async getAgent(agentId: string): Promise<unknown | null> {
    const match = this.state.agents.find((item) => {
      const record = asRecord(item);
      return record?.id === agentId;
    });

    return match ? deepClone(match) : null;
  }

  async controlAgent(action: 'pause' | 'resume', agentId: string): Promise<unknown | null> {
    const target = this.state.agents.find((item) => asRecord(item)?.id === agentId);
    const record = asRecord(target);
    if (!record) return null;

    record.status = action === 'pause' ? 'offline' : 'idle';
    record.updatedAt = this.nowIso();

    const event = {
      id: `oc-event-${Date.now()}`,
      type: action === 'pause' ? 'agent_paused' : 'agent_resumed',
      message: `${String(record.name ?? agentId)} ${action}d via runtime transport`,
      timestamp: this.nowIso(),
      metadata: { agentId }
    };

    this.state.events.unshift(event);
    this.emit(event);
    return deepClone(record);
  }

  async addAgent(payload: { name: string; role: string; status?: AgentStatus }): Promise<unknown> {
    const agent = {
      id: `oc-agent-${Date.now()}`,
      name: payload.name,
      role: payload.role,
      status: payload.status ?? 'idle',
      updatedAt: this.nowIso()
    };

    this.state.agents.push(agent);

    const event = {
      id: `oc-event-${Date.now()}`,
      type: 'agent_status_changed',
      message: `Agent ${agent.name} added via runtime transport`,
      timestamp: this.nowIso(),
      metadata: { agentId: agent.id }
    };

    this.state.events.unshift(event);
    this.emit(event);
    return deepClone(agent);
  }

  async listTasks(): Promise<unknown[]> {
    return deepClone(this.state.tasks);
  }

  async getTask(taskId: string): Promise<unknown | null> {
    const match = this.state.tasks.find((item) => asRecord(item)?.id === taskId);
    return match ? deepClone(match) : null;
  }

  async controlTask(action: 'retry' | 'update_status', taskId: string, status?: TaskStatus): Promise<unknown | null> {
    const target = this.state.tasks.find((item) => asRecord(item)?.id === taskId);
    const record = asRecord(target);
    if (!record) return null;

    record.status = action === 'retry' ? 'in_progress' : status ?? record.status;
    record.updatedAt = this.nowIso();

    const event = {
      id: `oc-event-${Date.now()}`,
      type: action === 'retry' ? 'task_retried' : 'task_updated',
      message: `Task ${String(record.title ?? taskId)} ${action === 'retry' ? 'retried' : 'updated'} via runtime transport`,
      timestamp: this.nowIso(),
      metadata: { taskId, status: record.status }
    };

    this.state.events.unshift(event);
    this.emit(event);
    return deepClone(record);
  }

  async addTask(payload: {
    title: string;
    priority: 'low' | 'medium' | 'high';
    description?: string;
    assigneeAgentId?: string;
    status?: TaskStatus;
  }): Promise<unknown> {
    const now = this.nowIso();
    const task = {
      id: `oc-task-${Date.now()}`,
      title: payload.title,
      description: payload.description,
      assigneeAgentId: payload.assigneeAgentId,
      status: payload.status ?? 'todo',
      priority: payload.priority,
      createdAt: now,
      updatedAt: now
    };

    this.state.tasks.push(task);

    const event = {
      id: `oc-event-${Date.now()}`,
      type: 'task_created',
      message: `Task ${task.title} created via runtime transport`,
      timestamp: now,
      metadata: { taskId: task.id }
    };

    this.state.events.unshift(event);
    this.emit(event);
    return deepClone(task);
  }

  async listEvents(limit?: number): Promise<unknown[]> {
    const list = deepClone(this.state.events);
    if (typeof limit === 'number' && Number.isFinite(limit)) {
      return list.slice(0, Math.max(0, Math.floor(limit)));
    }

    return list;
  }

  subscribe(listener: (payload: OpenClawRuntimeRawEventEnvelope) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

interface HttpOpenClawRuntimeTransportOptions {
  endpoint: string;
  apiKey: string;
  authHeaderName?: string;
  authScheme?: string;
  snapshotPath?: string;
  agentsPath?: string;
  tasksPath?: string;
  eventsPath?: string;
  pollMs?: number;
  pollMaxBackoffMs?: number;
  requestTimeoutMs?: number;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function joinPath(basePath: string, ...segments: string[]): string {
  const parts = [basePath, ...segments].map(trimSlashes).filter((value) => value.length > 0);
  return `/${parts.join('/')}`;
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function unwrapTransportPayload(payload: unknown): unknown {
  const record = asRecord(payload);
  if (record?.success === true && 'data' in record) {
    return record.data;
  }

  return payload;
}

function extractErrorMessage(payload: unknown, statusCode: number): string {
  const record = asRecord(payload);
  const errorRecord = asRecord(record?.error);
  const message =
    asString(errorRecord?.message) ??
    asString(record?.message) ??
    `OpenClaw runtime HTTP request failed with status ${statusCode}.`;

  return message;
}

export class HttpOpenClawRuntimeTransport implements OpenClawRuntimeTransport {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly authHeaderName: string;
  private readonly authScheme: string;
  private readonly snapshotPath: string;
  private readonly agentsPath: string;
  private readonly tasksPath: string;
  private readonly eventsPath: string;
  private readonly pollMs: number;
  private readonly pollMaxBackoffMs: number;
  private readonly requestTimeoutMs: number;

  constructor(options: HttpOpenClawRuntimeTransportOptions) {
    this.endpoint = options.endpoint;
    this.apiKey = options.apiKey;
    this.authHeaderName = options.authHeaderName ?? 'authorization';
    this.authScheme = options.authScheme ?? 'Bearer';
    this.snapshotPath = options.snapshotPath ?? '/snapshot';
    this.agentsPath = options.agentsPath ?? '/agents';
    this.tasksPath = options.tasksPath ?? '/tasks';
    this.eventsPath = options.eventsPath ?? '/events';
    this.pollMs = options.pollMs ?? 5000;
    this.pollMaxBackoffMs = Math.max(options.pollMaxBackoffMs ?? 30000, this.pollMs);
    this.requestTimeoutMs = options.requestTimeoutMs ?? 5000;
  }

  private buildUrl(pathname: string, query?: Record<string, string | number | undefined>): URL {
    const resolved = isAbsoluteHttpUrl(pathname)
      ? new URL(pathname)
      : new URL(trimSlashes(pathname), this.endpoint.endsWith('/') ? this.endpoint : `${this.endpoint}/`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined) continue;
        resolved.searchParams.set(key, String(value));
      }
    }

    return resolved;
  }

  private headers(body?: unknown): HeadersInit {
    const headers: Record<string, string> = {
      Accept: 'application/json'
    };

    const authValue = this.authScheme.length > 0 ? `${this.authScheme} ${this.apiKey}` : this.apiKey;
    headers[this.authHeaderName] = authValue;

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
    timeout.unref?.();

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
          throw new Error(`OpenClaw runtime HTTP response at ${pathname} was not valid JSON.`);
        }
      }

      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, response.status));
      }

      return unwrapTransportPayload(payload);
    } catch (error) {
      if (timedOut) {
        throw new Error(`OpenClaw runtime HTTP request to ${pathname} timed out after ${this.requestTimeoutMs}ms.`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortFromUpstreamSignal);
    }
  }

  async fetchSnapshot(): Promise<OpenClawRuntimeRawSnapshot> {
    const payload = await this.request(this.snapshotPath, {}, { allowNotFound: true });
    if (payload) {
      const record = asRecord(payload);
      const nestedSnapshot = asRecord(record?.snapshot);
      if (nestedSnapshot) {
        return nestedSnapshot as OpenClawRuntimeRawSnapshot;
      }

      return (record ?? {}) as OpenClawRuntimeRawSnapshot;
    }

    const [agents, tasks, events] = await Promise.all([
      this.listAgents(),
      this.listTasks(),
      this.listEvents()
    ]);

    return { agents, tasks, events };
  }

  async listAgents(): Promise<unknown[]> {
    const payload = await this.request(this.agentsPath, {}, { allowNotFound: true });
    if (payload === null) return [];

    if (Array.isArray(payload)) return payload;
    const record = asRecord(payload);
    return Array.isArray(record?.agents) ? record.agents : [];
  }

  async getAgent(agentId: string): Promise<unknown | null> {
    const itemPath = joinPath(this.agentsPath, encodeURIComponent(agentId));
    const payload = await this.request(itemPath, {}, { allowNotFound: true });
    if (payload !== null) {
      const record = asRecord(payload);
      return record?.agent ?? payload;
    }

    const agents = await this.listAgents();
    return agents.find((item) => asRecord(item)?.id === agentId) ?? null;
  }

  async controlAgent(action: 'pause' | 'resume', agentId: string): Promise<unknown | null> {
    const controlPath = joinPath(this.agentsPath, encodeURIComponent(agentId), action);
    const payload = await this.request(controlPath, { method: 'POST' }, { allowNotFound: true });
    return payload === null ? null : (asRecord(payload)?.agent ?? payload);
  }

  async addAgent(payload: { name: string; role: string; status?: AgentStatus }): Promise<unknown> {
    const created = await this.request(this.agentsPath, {
      method: 'POST',
      body: payload
    });

    return asRecord(created)?.agent ?? created;
  }

  async listTasks(): Promise<unknown[]> {
    const payload = await this.request(this.tasksPath, {}, { allowNotFound: true });
    if (payload === null) return [];

    if (Array.isArray(payload)) return payload;
    const record = asRecord(payload);
    return Array.isArray(record?.tasks) ? record.tasks : [];
  }

  async getTask(taskId: string): Promise<unknown | null> {
    const itemPath = joinPath(this.tasksPath, encodeURIComponent(taskId));
    const payload = await this.request(itemPath, {}, { allowNotFound: true });
    if (payload !== null) {
      const record = asRecord(payload);
      return record?.task ?? payload;
    }

    const tasks = await this.listTasks();
    return tasks.find((item) => asRecord(item)?.id === taskId) ?? null;
  }

  async controlTask(action: 'retry' | 'update_status', taskId: string, status?: TaskStatus): Promise<unknown | null> {
    if (action === 'retry') {
      const retryPath = joinPath(this.tasksPath, encodeURIComponent(taskId), 'retry');
      const payload = await this.request(retryPath, { method: 'POST' }, { allowNotFound: true });
      return payload === null ? null : (asRecord(payload)?.task ?? payload);
    }

    const statusPath = joinPath(this.tasksPath, encodeURIComponent(taskId), 'status');
    const payload = await this.request(
      statusPath,
      {
        method: 'PATCH',
        body: { status }
      },
      { allowNotFound: true }
    );
    return payload === null ? null : (asRecord(payload)?.task ?? payload);
  }

  async addTask(payload: {
    title: string;
    priority: 'low' | 'medium' | 'high';
    description?: string;
    assigneeAgentId?: string;
    status?: TaskStatus;
  }): Promise<unknown> {
    const created = await this.request(this.tasksPath, {
      method: 'POST',
      body: payload
    });

    return asRecord(created)?.task ?? created;
  }

  async listEvents(limit?: number): Promise<unknown[]> {
    const payload = await this.request(this.eventsPath, { method: 'GET' }, { allowNotFound: true });
    if (payload === null) return [];

    const events =
      Array.isArray(payload) ? payload : Array.isArray(asRecord(payload)?.events) ? (asRecord(payload)?.events as unknown[]) : [];

    if (typeof limit === 'number' && Number.isFinite(limit)) {
      return events.slice(0, Math.max(0, Math.floor(limit)));
    }

    return events;
  }

  subscribe(listener: (payload: OpenClawRuntimeRawEventEnvelope) => void): () => void {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let previousSignature: string | null = null;
    let backoffDelayMs = this.pollMs;

    const schedule = (delay: number) => {
      timer = setTimeout(run, delay);
      timer.unref?.();
    };

    const run = async () => {
      if (!active) return;

      let nextDelay = this.pollMs;

      try {
        const snapshot = await this.fetchSnapshot();
        const signature = JSON.stringify(snapshot);

        if (previousSignature !== null && previousSignature !== signature) {
          listener({ snapshot });
        }

        previousSignature = signature;
        backoffDelayMs = this.pollMs;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        nextDelay = backoffDelayMs;
        backoffDelayMs = Math.min(backoffDelayMs * 2, this.pollMaxBackoffMs);
        console.warn(`[runtime][openclaw-http] subscription poll failed: ${message}; retrying in ${nextDelay}ms`);
      } finally {
        if (active) {
          schedule(nextDelay);
        }
      }
    };

    schedule(0);

    return () => {
      active = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
  }
}

export function createOpenClawTransportFromEnv(): OpenClawRuntimeTransport | null {
  const fixture = FixtureRuntimeTransport.fromEnv();
  if (fixture) return fixture;

  const endpoint = process.env.OPENCLAW_RUNTIME_ENDPOINT?.trim();
  const apiKey = process.env.OPENCLAW_RUNTIME_API_KEY?.trim();

  if (!endpoint || !apiKey) {
    return null;
  }

  return new HttpOpenClawRuntimeTransport({
    endpoint,
    apiKey,
    authHeaderName: process.env.OPENCLAW_RUNTIME_AUTH_HEADER?.trim() || undefined,
    authScheme: process.env.OPENCLAW_RUNTIME_AUTH_SCHEME?.trim() ?? 'Bearer',
    snapshotPath: process.env.OPENCLAW_RUNTIME_SNAPSHOT_PATH?.trim() || undefined,
    agentsPath: process.env.OPENCLAW_RUNTIME_AGENTS_PATH?.trim() || undefined,
    tasksPath: process.env.OPENCLAW_RUNTIME_TASKS_PATH?.trim() || undefined,
    eventsPath: process.env.OPENCLAW_RUNTIME_EVENTS_PATH?.trim() || undefined,
    pollMs: parsePositiveInteger(process.env.OPENCLAW_RUNTIME_POLL_MS, 5000),
    pollMaxBackoffMs: parsePositiveInteger(process.env.OPENCLAW_RUNTIME_POLL_MAX_BACKOFF_MS, 30000),
    requestTimeoutMs: parsePositiveInteger(process.env.OPENCLAW_RUNTIME_REQUEST_TIMEOUT_MS, 5000)
  });
}
