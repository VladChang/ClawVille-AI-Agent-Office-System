import { Agent, Event, Overview, Task, TaskStatus } from '../models/types';

export interface RuntimeSnapshot {
  overview: Overview;
  agents: Agent[];
  tasks: Task[];
  events: Event[];
}

export interface RuntimeSource {
  // Snapshot / list operations
  getOverview(): Overview;
  getSnapshot(): RuntimeSnapshot;
  listAgents(): Agent[];
  listTasks(): Task[];
  listEvents(limit?: number): Event[];

  // Control / mutation operations
  addAgent(payload: Pick<Agent, 'name' | 'role'> & Partial<Pick<Agent, 'status'>>): Agent;
  pauseAgent(agentId: string): Agent | undefined;
  resumeAgent(agentId: string): Agent | undefined;
  addTask(payload: Pick<Task, 'title' | 'priority'> & Partial<Omit<Task, 'id' | 'title' | 'priority' | 'createdAt' | 'updatedAt'>>): Task;
  updateTaskStatus(taskId: string, status: TaskStatus): Task | undefined;
  retryTask(taskId: string): Task | undefined;

  // Realtime hooks
  onStateChange(listener: (payload: { snapshot: RuntimeSnapshot; event?: Event }) => void): () => void;
  updateRandomState(): Event;
}
