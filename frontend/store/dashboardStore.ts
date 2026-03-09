'use client';

import { create } from 'zustand';
import {
  connectDashboardWs,
  fetchAgents,
  fetchEvents,
  fetchTasks,
  getConfiguredRuntimeMode,
  pauseAgent,
  resumeAgent,
  retryTask,
  updateAgentDisplayName
} from '@/lib/api';
import { buildDashboardDerivedState } from '@/lib/dashboardDerivedState';
import { shouldRetryRealtimeConnection, shouldStartRealtimeAfterLoadError } from '@/lib/realtimePolicy';
import { isInvalidRealtimePayloadCloseEvent, isRealModeStrictError, isRuntimeNotConfiguredError } from '@/lib/runtimeAdapter';
import type { Agent, Event, Task } from '@/types/models';

export type DashboardConnectionStatus = 'idle' | 'connecting' | 'connected' | 'degraded' | 'disconnected';

interface DashboardState {
  agents: Agent[];
  tasks: Task[];
  events: Event[];
  activeAgentCount: number;
  blockedTaskCount: number;
  agentNameById: Record<string, string>;
  currentTaskByAgentId: Record<string, Task>;
  blockedTaskByAgentId: Record<string, Task>;
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
  updateSelectedAgentDisplayName: (displayName: string | null) => Promise<void>;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let hasConnectedRealtime = false;

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

function snapshotState(snapshot: { agents: Agent[]; tasks: Task[]; events: Event[] }): Partial<DashboardState> {
  return {
    agents: snapshot.agents,
    tasks: snapshot.tasks,
    events: [...snapshot.events].reverse(),
    hasLoaded: true,
    loading: false,
    ...buildDashboardDerivedState(snapshot.agents, snapshot.tasks)
  };
}

function applyAgentUpdate(state: DashboardState, nextAgent: Agent): Partial<DashboardState> {
  const agents = state.agents.map((agent) => (agent.id === nextAgent.id ? nextAgent : agent));
  return {
    agents,
    ...buildDashboardDerivedState(agents, state.tasks)
  };
}

function applyTaskUpdate(state: DashboardState, nextTask: Task): Partial<DashboardState> {
  const tasks = state.tasks.map((task) => (task.id === nextTask.id ? nextTask : task));
  return {
    tasks,
    ...buildDashboardDerivedState(state.agents, tasks)
  };
}

function startSocket(set: (partial: Partial<DashboardState>) => void, get: () => DashboardState): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  set({ connectionStatus: 'connecting', connectionMessage: '正在連線至即時更新…' });

  ws = connectDashboardWs((message) => {
    set(snapshotState(message.data.snapshot));
  });

  ws.onopen = () => {
    reconnectAttempt = 0;
    hasConnectedRealtime = true;
    clearReconnectTimer();
    set({ connectionStatus: 'connected', connectionMessage: null });
  };

  ws.onerror = () => {
    set({
      connectionStatus: 'degraded',
      connectionMessage: '即時串流不穩定，先顯示目前可取得的最新資料。'
    });
  };

  ws.onclose = (event) => {
    ws = null;
    const contractMismatch = isInvalidRealtimePayloadCloseEvent(event);

    if (!shouldRetryRealtimeConnection(hasConnectedRealtime, reconnectAttempt)) {
      clearReconnectTimer();
      set({
        connectionStatus: 'degraded',
        connectionMessage: contractMismatch
          ? '偵測到即時 payload 契約不一致，請檢查前後端 runtime contract 是否同步。'
          : '目前無法使用即時連線，待 backend websocket 恢復後再重新整理。'
      });
      return;
    }

    const delay = reconnectDelayMs(reconnectAttempt);
    reconnectAttempt += 1;

    set({
      connectionStatus: 'disconnected',
      connectionMessage: contractMismatch
        ? `偵測到即時 payload 契約不一致，將於 ${Math.ceil(delay / 1000)} 秒後重試…`
        : `即時連線已中斷，將於 ${Math.ceil(delay / 1000)} 秒後重試…`
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
  activeAgentCount: 0,
  blockedTaskCount: 0,
  agentNameById: {},
  currentTaskByAgentId: {},
  blockedTaskByAgentId: {},
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
    const runtimeMode = getConfiguredRuntimeMode();
    clearReconnectTimer();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reconnectAttempt = 0;
      hasConnectedRealtime = false;
    }
    set({ loading: !hasLoaded, error: null });

    try {
      const [agents, tasks, events] = await Promise.all([fetchAgents(), fetchTasks(), fetchEvents()]);
      set({
        ...snapshotState({ agents, tasks, events }),
        error: null
      });
      startSocket(set, get);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '載入儀表板資料失敗。';
      const runtimeNotConfigured = isRuntimeNotConfiguredError(error);
      set({
        loading: false,
        connectionStatus: 'degraded',
        error: errorMessage,
        connectionMessage: isRealModeStrictError(error)
          ? runtimeNotConfigured
            ? '尚未設定 OpenClaw adapter。請在 backend 設定 OPENCLAW_ADAPTER_ENDPOINT（或暫時用 ALLOW_RUNTIME_FALLBACK=true 啟用 mock fallback）。'
            : '真實 runtime 模式目前不可用，請檢查 backend 的 adapter / runtime 設定。'
          : '若可用，將先使用 fallback / 本機資料。'
      });

      if ((get().agents.length > 0 || get().tasks.length > 0 || get().events.length > 0) && !get().hasLoaded) {
        set({ hasLoaded: true });
      }

      if (shouldStartRealtimeAfterLoadError(runtimeMode, error)) {
        startSocket(set, get);
      }
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
      const nextAgent = await pauseAgent(agentId);
      set(applyAgentUpdate(get(), nextAgent));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '暫停 Agent 失敗。' });
    } finally {
      set({ controlLoading: false });
    }
  },
  resumeSelectedAgent: async () => {
    const agentId = get().selectedAgentId;
    if (!agentId) return;

    set({ controlLoading: true, error: null });
    try {
      const nextAgent = await resumeAgent(agentId);
      set(applyAgentUpdate(get(), nextAgent));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '恢復 Agent 失敗。' });
    } finally {
      set({ controlLoading: false });
    }
  },
  retrySelectedAgentTask: async () => {
    const selectedAgentId = get().selectedAgentId;
    const task = selectedAgentId ? get().blockedTaskByAgentId[selectedAgentId] : undefined;
    if (!task) {
      set({ error: '這位 Agent 目前沒有阻塞中的任務。' });
      return;
    }

    set({ controlLoading: true, error: null });
    try {
      const nextTask = await retryTask(task.id);
      set(applyTaskUpdate(get(), nextTask));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '重試任務失敗。' });
    } finally {
      set({ controlLoading: false });
    }
  },
  updateSelectedAgentDisplayName: async (displayName) => {
    const agentId = get().selectedAgentId;
    if (!agentId) return;

    set({ controlLoading: true, error: null });
    try {
      const nextAgent = await updateAgentDisplayName(agentId, displayName);
      set(applyAgentUpdate(get(), nextAgent));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '更新 Agent 顯示別名失敗。' });
    } finally {
      set({ controlLoading: false });
    }
  }
}));
