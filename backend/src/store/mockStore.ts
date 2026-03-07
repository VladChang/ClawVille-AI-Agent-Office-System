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
  TaskStatus
} from '../models/types';
import { RuntimeSnapshot } from '../runtime/runtimeSource';

const nowIso = () => new Date().toISOString();

export type StoreSnapshot = RuntimeSnapshot;

export class MockStore {
  private readonly emitter = new EventEmitter();

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
    {
      id: 'e-1',
      type: 'system',
      message: 'ClawVille backend initialized',
      timestamp: nowIso()
    }
  ];

  getOverview(): Overview {
    const agentsByStatus = this.countByStatus<AgentStatus>(this.agents.map((a) => a.status), [...AGENT_STATUSES]);
    const tasksByStatus = this.countByStatus<TaskStatus>(this.tasks.map((t) => t.status), [...TASK_STATUSES]);

    return {
      generatedAt: nowIso(),
      counts: {
        agents: this.agents.length,
        tasks: this.tasks.length,
        events: this.events.length,
        activeAgents: this.agents.filter((a) => a.status !== 'offline').length,
        openTasks: this.tasks.filter((t) => t.status !== 'done').length
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
    agent.status = 'offline';
    agent.updatedAt = nowIso();
    const event = this.pushEvent('agent_paused', `Agent paused: ${agent.name}`, { agentId: agent.id });
    this.emitState(event);
    return agent;
  }

  resumeAgent(agentId: string): Agent | undefined {
    const agent = this.getAgent(agentId);
    if (!agent) return undefined;
    agent.status = 'idle';
    agent.updatedAt = nowIso();
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

    task.status = status;
    task.updatedAt = nowIso();
    const event = this.pushEvent('task_updated', `Task updated: ${task.title} -> ${status}`, { taskId: task.id, status });
    this.emitState(event);

    return task;
  }

  retryTask(taskId: string): Task | undefined {
    const task = this.getTask(taskId);
    if (!task) return undefined;

    task.status = 'in_progress';
    task.updatedAt = nowIso();
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
    randomAgent.status = nextStatus;
    randomAgent.updatedAt = nowIso();

    const event = this.pushEvent('agent_status_changed', `Agent status changed: ${randomAgent.name} -> ${nextStatus}`, {
      agentId: randomAgent.id,
      status: nextStatus
    });
    this.emitState(event);
    return event;
  }

  pushEvent(type: EventType, message: string, metadata?: Record<string, unknown>): Event {
    const event: Event = {
      id: uuidv4(),
      type,
      message,
      timestamp: nowIso(),
      metadata
    };
    this.events.push(event);
    return event;
  }

  onStateChange(listener: (payload: { snapshot: StoreSnapshot; event?: Event }) => void): () => void {
    this.emitter.on('state', listener);
    return () => this.emitter.off('state', listener);
  }

  private emitState(event?: Event): void {
    this.emitter.emit('state', { snapshot: this.getSnapshot(), event });
  }

  private countByStatus<T extends string>(values: T[], statuses: T[]): Record<T, number> {
    return statuses.reduce(
      (acc, status) => {
        acc[status] = values.filter((value) => value === status).length;
        return acc;
      },
      {} as Record<T, number>
    );
  }
}

export const store = new MockStore();
