'use client';

import { create } from 'zustand';
import { connectDashboardWs, fetchAgents, fetchEvents, fetchTasks, pauseAgent, resumeAgent, retryTask } from '@/lib/api';
import type { Agent, Event, Task } from '@/types/models';

export type DashboardConnectionStatus = 'idle' | 'connecting' | 'connected' | 'degraded' | 'disconnected';

interface DashboardState {
  agents: Agent[];
  tasks: Task[];
  events: Event[];
  selectedAgentId: string | null;
  loading: boolean;
  hasLoaded: boolean;
  error: string | null;
  connectionStatus: DashboardConnectionStatus;
  connectionMessage: string | null;
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
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;

const reconnectBaseMs = 1000;
const reconnectMaxMs = 30000;

function reconnectDelayMs(attempt: number): number {
  const exp = Math.min(reconnectMaxMs, reconnectBaseMs * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 400);
  return exp + jitter;
}

function clearReconnectTimer(): void {
  if (!reconnectTimer) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function startSocket(set: (partial: Partial<DashboardState>) => void, get: () => DashboardState): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  set({ connectionStatus: 'connecting', connectionMessage: 'Connecting to realtime updates…' });

  ws = connectDashboardWs((message) => {
    const snapshot = message.data.snapshot;
    set({
      agents: snapshot.agents,
      tasks: snapshot.tasks,
      events: [...snapshot.events].reverse(),
      hasLoaded: true,
      loading: false
    });
  });

  ws.onopen = () => {
    reconnectAttempt = 0;
    clearReconnectTimer();
    set({ connectionStatus: 'connected', connectionMessage: null });
  };

  ws.onerror = () => {
    set({
      connectionStatus: 'degraded',
      connectionMessage: 'Realtime stream is unstable. Showing latest available data.'
    });
  };

  ws.onclose = () => {
    ws = null;

    const delay = reconnectDelayMs(reconnectAttempt);
    reconnectAttempt += 1;

    set({
      connectionStatus: 'disconnected',
      connectionMessage: `Realtime disconnected. Retrying in ${Math.ceil(delay / 1000)}s…`
    });

    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      startSocket(set, get);
    }, delay);
  };
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  agents: [],
  tasks: [],
  events: [],
  selectedAgentId: null,
  loading: false,
  hasLoaded: false,
  error: null,
  connectionStatus: 'idle',
  connectionMessage: null,
  controlLoading: false,
  agentSearch: '',
  agentStatusFilter: 'all',
  taskSearch: '',
  eventLevelFilter: 'all',
  initialize: async () => {
    const hasLoaded = get().hasLoaded;
    set({ loading: !hasLoaded, error: null });

    try {
      const [agents, tasks, events] = await Promise.all([fetchAgents(), fetchTasks(), fetchEvents()]);
      set({
        agents,
        tasks,
        events: [...events].reverse(),
        loading: false,
        hasLoaded: true,
        error: null
      });
      startSocket(set, get);
    } catch (error) {
      set({
        loading: false,
        connectionStatus: 'degraded',
        error: error instanceof Error ? error.message : 'Failed to load dashboard data.',
        connectionMessage: 'Using fallback/local data when available.'
      });

      if ((get().agents.length > 0 || get().tasks.length > 0 || get().events.length > 0) && !get().hasLoaded) {
        set({ hasLoaded: true });
      }

      startSocket(set, get);
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
