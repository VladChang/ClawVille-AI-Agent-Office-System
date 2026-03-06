'use client';

import { create } from 'zustand';
import { connectDashboardWs, fetchAgents, fetchEvents, fetchTasks, pauseAgent, resumeAgent, retryTask } from '@/lib/api';
import type { Agent, Event, Task } from '@/types/models';

interface DashboardState {
  agents: Agent[];
  tasks: Task[];
  events: Event[];
  selectedAgentId: string | null;
  loading: boolean;
  error: string | null;
  controlLoading: boolean;
  agentSearch: string;
  agentStatusFilter: 'all' | Agent['status'];
  taskSearch: string;
  eventLevelFilter: 'all' | Event['level'];
  initialize: () => Promise<void>;
  selectAgent: (id: string | null) => void;
  setAgentSearch: (value: string) => void;
  setAgentStatusFilter: (value: 'all' | Agent['status']) => void;
  setTaskSearch: (value: string) => void;
  setEventLevelFilter: (value: 'all' | Event['level']) => void;
  pauseSelectedAgent: () => Promise<void>;
  resumeSelectedAgent: () => Promise<void>;
  retrySelectedAgentTask: () => Promise<void>;
}

let ws: WebSocket | null = null;

export const useDashboardStore = create<DashboardState>((set, get) => ({
  agents: [],
  tasks: [],
  events: [],
  selectedAgentId: null,
  loading: false,
  error: null,
  controlLoading: false,
  agentSearch: '',
  agentStatusFilter: 'all',
  taskSearch: '',
  eventLevelFilter: 'all',
  initialize: async () => {
    set({ loading: true, error: null });

    try {
      const [agents, tasks, events] = await Promise.all([fetchAgents(), fetchTasks(), fetchEvents()]);
      set({ agents, tasks, events: [...events].reverse(), loading: false, error: null });

      if (ws) return;

      ws = connectDashboardWs((message) => {
        const snapshot = message.data.snapshot;
        set({
          agents: snapshot.agents,
          tasks: snapshot.tasks,
          events: [...snapshot.events].reverse()
        });
      });

      ws.onerror = () => {
        set({ error: 'Realtime connection failed. Showing latest loaded data.' });
      };

      ws.onclose = () => {
        ws = null;
      };
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Failed to load dashboard data.' });
    }
  },
  selectAgent: (id) => set({ selectedAgentId: id }),
  setAgentSearch: (value) => set({ agentSearch: value }),
  setAgentStatusFilter: (value) => set({ agentStatusFilter: value }),
  setTaskSearch: (value) => set({ taskSearch: value }),
  setEventLevelFilter: (value) => set({ eventLevelFilter: value }),
  pauseSelectedAgent: async () => {
    const agentId = get().selectedAgentId;
    if (!agentId) return;

    set({ controlLoading: true, error: null });
    try {
      await pauseAgent(agentId);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to pause agent.' });
    } finally {
      set({ controlLoading: false });
    }
  },
  resumeSelectedAgent: async () => {
    const agentId = get().selectedAgentId;
    if (!agentId) return;

    set({ controlLoading: true, error: null });
    try {
      await resumeAgent(agentId);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to resume agent.' });
    } finally {
      set({ controlLoading: false });
    }
  },
  retrySelectedAgentTask: async () => {
    const selectedAgentId = get().selectedAgentId;
    const task = get().tasks.find((item) => item.assigneeAgentId === selectedAgentId && item.status === 'blocked');
    if (!task) {
      set({ error: 'No blocked task found for this agent.' });
      return;
    }

    set({ controlLoading: true, error: null });
    try {
      await retryTask(task.id);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to retry task.' });
    } finally {
      set({ controlLoading: false });
    }
  }
}));
