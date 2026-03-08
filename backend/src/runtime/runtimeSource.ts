import { Agent, Event, Overview, Task, TaskStatus } from '../models/types';

export interface RuntimeSnapshot {
  overview: Overview;
  agents: Agent[];
  tasks: Task[];
  events: Event[];
}

export interface RuntimeSource {
  // Snapshot / list operations
  getOverview(): Promise<Overview>;
  getSnapshot(): Promise<RuntimeSnapshot>;
  listAgents(): Promise<Agent[]>;
  listTasks(): Promise<Task[]>;
  listEvents(limit?: number): Promise<Event[]>;

  // Control / mutation operations
  addAgent(payload: Pick<Agent, 'name' | 'role'> & Partial<Pick<Agent, 'status'>>): Promise<Agent>;
  pauseAgent(agentId: string): Promise<Agent | undefined>;
  resumeAgent(agentId: string): Promise<Agent | undefined>;
  addTask(
    payload: Pick<Task, 'title' | 'priority'> & Partial<Omit<Task, 'id' | 'title' | 'priority' | 'createdAt' | 'updatedAt'>>
  ): Promise<Task>;
  updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task | undefined>;
  retryTask(taskId: string): Promise<Task | undefined>;

  // Realtime hooks
  onStateChange(listener: (payload: { snapshot: RuntimeSnapshot; event?: Event }) => void): () => void;
  updateRandomState(): Event;
}
