import { EventEmitter } from 'node:events';
import { v4 as uuidv4 } from 'uuid';
import {
  AGENT_STATUSES,
  TASK_STATUSES,
  Agent,
  AgentStatus,
  Event,
  EventType,
  Overview,
  Task,
  TaskStatus,
  normalizeEventLevel
} from '../models/types';
import { RuntimeSnapshot } from '../runtime/runtimeSource';
import {
  AgentStatusRecord,
  JsonFilePersistence,
  PersistedRuntimeData,
  TaskTransitionRecord
} from './jsonPersistence';

const nowIso = () => new Date().toISOString();
const DEFAULT_MAX_EVENTS = 500;
const DEFAULT_MAX_TASK_TRANSITIONS = 1000;
const DEFAULT_MAX_AGENT_STATUS_CHANGES = 1000;

function canonicalizeEvent(event: Event): Event {
  return {
    ...event,
    level: normalizeEventLevel(event.level, event.type, event.metadata)
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export type StoreSnapshot = RuntimeSnapshot;

export class MockStore {
  private readonly emitter = new EventEmitter();
  private readonly maxEvents = parsePositiveInteger(process.env.RUNTIME_MAX_EVENTS, DEFAULT_MAX_EVENTS);
  private readonly maxTaskTransitions = parsePositiveInteger(
    process.env.RUNTIME_MAX_TASK_TRANSITIONS,
    DEFAULT_MAX_TASK_TRANSITIONS
  );
  private readonly maxAgentStatusChanges = parsePositiveInteger(
    process.env.RUNTIME_MAX_AGENT_STATUS_CHANGES,
    DEFAULT_MAX_AGENT_STATUS_CHANGES
  );

  private taskTransitions: TaskTransitionRecord[] = [];
  private agentStatusChanges: AgentStatusRecord[] = [];

  private agents: Agent[] = [
    { id: 'a-1', name: 'Nova', role: 'Planner', status: 'busy', updatedAt: nowIso() },
    { id: 'a-2', name: 'Echo', role: 'Implementer', status: 'idle', updatedAt: nowIso() },
    { id: 'a-3', name: 'Rook', role: 'Reviewer', status: 'offline', updatedAt: nowIso() }
  ];

  private tasks: Task[] = [
    {
      id: 't-1',
      title: 'Bootstrap backend skeleton',
      description: 'Set up API and realtime endpoint',
      assigneeAgentId: 'a-2',
      status: 'in_progress',
      priority: 'high',
      createdAt: nowIso(),
      updatedAt: nowIso()
    },
    {
      id: 't-2',
      title: 'Draft frontend dashboard placeholders',
      status: 'todo',
      priority: 'medium',
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
  ];

  private events: Event[] = [
    canonicalizeEvent({
      id: 'e-1',
      type: 'system',
      message: 'ClawVille backend initialized',
      timestamp: nowIso()
    })
  ];

  constructor(private readonly persistence?: JsonFilePersistence) {
    const persisted = this.persistence?.load();
    if (!persisted) return;

    this.agents = persisted.snapshot.agents;
    this.tasks = persisted.snapshot.tasks;
    this.events = persisted.snapshot.events.map(canonicalizeEvent).slice(-this.maxEvents);
    this.taskTransitions = persisted.history.taskTransitions.slice(-this.maxTaskTransitions);
    this.agentStatusChanges = persisted.history.agentStatusChanges.slice(-this.maxAgentStatusChanges);
  }

  getOverview(): Overview {
    const agentsByStatus: Record<AgentStatus, number> = { idle: 0, busy: 0, offline: 0 };
    let activeAgents = 0;

    for (const agent of this.agents) {
      agentsByStatus[agent.status] += 1;
      if (agent.status !== 'offline') {
        activeAgents += 1;
      }
    }

    const tasksByStatus: Record<TaskStatus, number> = { todo: 0, in_progress: 0, blocked: 0, done: 0 };
    let openTasks = 0;

    for (const task of this.tasks) {
      tasksByStatus[task.status] += 1;
      if (task.status !== 'done') {
        openTasks += 1;
      }
    }

    return {
      generatedAt: nowIso(),
      counts: {
        agents: this.agents.length,
        tasks: this.tasks.length,
        events: this.events.length,
        activeAgents,
        openTasks
      },
      agentsByStatus,
      tasksByStatus
    };
  }

  getSnapshot(): StoreSnapshot {
    return {
      overview: this.getOverview(),
      agents: this.listAgents(),
      tasks: this.listTasks(),
      events: this.listEvents(50)
    };
  }

  listAgents(): Agent[] {
    return [...this.agents];
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agents.find((agent) => agent.id === agentId);
  }

  addAgent(payload: Pick<Agent, 'name' | 'role'> & Partial<Pick<Agent, 'status'>>): Agent {
    const agent: Agent = {
      id: uuidv4(),
      name: payload.name,
      role: payload.role,
      status: payload.status ?? 'idle',
      updatedAt: nowIso()
    };
    this.agents.push(agent);
    const event = this.pushEvent('system', `Agent created: ${agent.name}`, { agentId: agent.id });
    this.emitState(event);
    return agent;
  }

  pauseAgent(agentId: string): Agent | undefined {
    const agent = this.getAgent(agentId);
    if (!agent) return undefined;
    const previous = agent.status;
    agent.status = 'offline';
    agent.updatedAt = nowIso();
    this.recordAgentStatusChange(agent.id, previous, agent.status);
    const event = this.pushEvent('agent_paused', `Agent paused: ${agent.name}`, { agentId: agent.id });
    this.emitState(event);
    return agent;
  }

  resumeAgent(agentId: string): Agent | undefined {
    const agent = this.getAgent(agentId);
    if (!agent) return undefined;
    const previous = agent.status;
    agent.status = 'idle';
    agent.updatedAt = nowIso();
    this.recordAgentStatusChange(agent.id, previous, agent.status);
    const event = this.pushEvent('agent_resumed', `Agent resumed: ${agent.name}`, { agentId: agent.id });
    this.emitState(event);
    return agent;
  }

  listTasks(): Task[] {
    return [...this.tasks];
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.find((task) => task.id === taskId);
  }

  addTask(payload: Pick<Task, 'title' | 'priority'> & Partial<Omit<Task, 'id' | 'title' | 'priority' | 'createdAt' | 'updatedAt'>>): Task {
    const task: Task = {
      id: uuidv4(),
      title: payload.title,
      description: payload.description,
      assigneeAgentId: payload.assigneeAgentId,
      status: payload.status ?? 'todo',
      priority: payload.priority,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    this.tasks.push(task);
    const event = this.pushEvent('task_created', `Task created: ${task.title}`, { taskId: task.id });
    this.emitState(event);
    return task;
  }

  updateTaskStatus(taskId: string, status: TaskStatus): Task | undefined {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return undefined;

    const previous = task.status;
    task.status = status;
    task.updatedAt = nowIso();
    this.recordTaskTransition(task.id, previous, task.status);
    const event = this.pushEvent('task_updated', `Task updated: ${task.title} -> ${status}`, { taskId: task.id, status });
    this.emitState(event);

    return task;
  }

  retryTask(taskId: string): Task | undefined {
    const task = this.getTask(taskId);
    if (!task) return undefined;

    const previous = task.status;
    task.status = 'in_progress';
    task.updatedAt = nowIso();
    this.recordTaskTransition(task.id, previous, task.status);
    const event = this.pushEvent('task_retried', `Task retried: ${task.title}`, { taskId: task.id, status: task.status });
    this.emitState(event);
    return task;
  }

  listEvents(limit?: number): Event[] {
    if (!limit || limit <= 0) return [...this.events];
    return this.events.slice(Math.max(this.events.length - limit, 0));
  }

  updateRandomState(): Event {
    const roll = Math.random();
    if (roll < 0.5 && this.tasks.length > 0) {
      const randomTask = this.tasks[Math.floor(Math.random() * this.tasks.length)];
      const statuses: TaskStatus[] = [...TASK_STATUSES];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      this.updateTaskStatus(randomTask.id, status);
      return this.events[this.events.length - 1];
    }

    const randomAgent = this.agents[Math.floor(Math.random() * this.agents.length)];
    const statuses: AgentStatus[] = [...AGENT_STATUSES];
    const nextStatus = statuses[Math.floor(Math.random() * statuses.length)];
    const previous = randomAgent.status;
    randomAgent.status = nextStatus;
    randomAgent.updatedAt = nowIso();
    this.recordAgentStatusChange(randomAgent.id, previous, randomAgent.status);

    const event = this.pushEvent('agent_status_changed', `Agent status changed: ${randomAgent.name} -> ${nextStatus}`, {
      agentId: randomAgent.id,
      status: nextStatus
    });
    this.emitState(event);
    return event;
  }

  pushEvent(type: EventType, message: string, metadata?: Record<string, unknown>): Event {
    const event = canonicalizeEvent({
      id: uuidv4(),
      type,
      message,
      timestamp: nowIso(),
      metadata
    });
    this.pushBounded(this.events, event, this.maxEvents);
    return event;
  }

  onStateChange(listener: (payload: { snapshot: StoreSnapshot; event?: Event }) => void): () => void {
    this.emitter.on('state', listener);
    return () => this.emitter.off('state', listener);
  }

  async flush(): Promise<void> {
    await this.persistence?.flush();
  }

  private recordTaskTransition(taskId: string, from: TaskStatus, to: TaskStatus): void {
    this.pushBounded(this.taskTransitions, { taskId, from, to, at: nowIso() }, this.maxTaskTransitions);
  }

  private recordAgentStatusChange(agentId: string, from: AgentStatus, to: AgentStatus): void {
    this.pushBounded(
      this.agentStatusChanges,
      { agentId, from, to, at: nowIso() },
      this.maxAgentStatusChanges
    );
  }

  private toPersistedData(): PersistedRuntimeData {
    return {
      version: 1,
      snapshot: {
        agents: this.agents,
        tasks: this.tasks,
        events: this.events
      },
      history: {
        taskTransitions: this.taskTransitions,
        agentStatusChanges: this.agentStatusChanges
      }
    };
  }

  private persist(): void {
    this.persistence?.save(this.toPersistedData());
  }

  private emitState(event?: Event): void {
    this.persist();
    this.emitter.emit('state', { snapshot: this.getSnapshot(), event });
  }

  private pushBounded<T>(list: T[], entry: T, max: number): void {
    list.push(entry);
    if (list.length > max) {
      list.splice(0, list.length - max);
    }
  }
}

function createPersistenceFromEnv(): JsonFilePersistence | undefined {
  const enabled = process.env.RUNTIME_PERSISTENCE_ENABLED === 'true' || process.env.RUNTIME_PERSISTENCE_ENABLED === '1';
  if (!enabled) return undefined;

  const filePath = process.env.RUNTIME_PERSISTENCE_FILE?.trim() || '.data/runtime-state.json';
  return new JsonFilePersistence(filePath);
}

export const store = new MockStore(createPersistenceFromEnv());
