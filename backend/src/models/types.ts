export type AgentStatus = 'idle' | 'busy' | 'offline';
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type EventType =
  | 'task_created'
  | 'task_updated'
  | 'task_retried'
  | 'agent_status_changed'
  | 'agent_paused'
  | 'agent_resumed'
  | 'system';

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assigneeAgentId?: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  type: EventType;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Overview {
  generatedAt: string;
  counts: {
    agents: number;
    tasks: number;
    events: number;
    activeAgents: number;
    openTasks: number;
  };
  agentsByStatus: Record<AgentStatus, number>;
  tasksByStatus: Record<TaskStatus, number>;
}
