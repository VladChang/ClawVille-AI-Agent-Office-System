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
  fetchSnapshot(): OpenClawRuntimeRawSnapshot;
  listAgents(): unknown[];
  getAgent(agentId: string): unknown | null;
  controlAgent(action: 'pause' | 'resume', agentId: string): unknown | null;
  addAgent(payload: { name: string; role: string; status?: AgentStatus }): unknown;

  listTasks(): unknown[];
  getTask(taskId: string): unknown | null;
  controlTask(action: 'retry' | 'update_status', taskId: string, status?: TaskStatus): unknown | null;
  addTask(payload: {
    title: string;
    priority: 'low' | 'medium' | 'high';
    description?: string;
    assigneeAgentId?: string;
    status?: TaskStatus;
  }): unknown;

  listEvents(limit?: number): unknown[];
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
      snapshot: this.fetchSnapshot(),
      event
    };

    this.listeners.forEach((listener) => listener(deepClone(payload)));
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  fetchSnapshot(): OpenClawRuntimeRawSnapshot {
    return {
      agents: deepClone(this.state.agents),
      tasks: deepClone(this.state.tasks),
      events: deepClone(this.state.events)
    };
  }

  listAgents(): unknown[] {
    return deepClone(this.state.agents);
  }

  getAgent(agentId: string): unknown | null {
    const match = this.state.agents.find((item) => {
      const record = asRecord(item);
      return record?.id === agentId;
    });

    return match ? deepClone(match) : null;
  }

  controlAgent(action: 'pause' | 'resume', agentId: string): unknown | null {
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

  addAgent(payload: { name: string; role: string; status?: AgentStatus }): unknown {
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

  listTasks(): unknown[] {
    return deepClone(this.state.tasks);
  }

  getTask(taskId: string): unknown | null {
    const match = this.state.tasks.find((item) => asRecord(item)?.id === taskId);
    return match ? deepClone(match) : null;
  }

  controlTask(action: 'retry' | 'update_status', taskId: string, status?: TaskStatus): unknown | null {
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

  addTask(payload: {
    title: string;
    priority: 'low' | 'medium' | 'high';
    description?: string;
    assigneeAgentId?: string;
    status?: TaskStatus;
  }): unknown {
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

  listEvents(limit?: number): unknown[] {
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

export function createOpenClawTransportFromEnv(): OpenClawRuntimeTransport | null {
  return FixtureRuntimeTransport.fromEnv();
}
