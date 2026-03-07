import { mockAgents, mockEvents, mockTasks } from '@/lib/mockData';
import { getRuntimeMode, type RuntimeMode } from '@/lib/runtime';
import { normalizeAgent, normalizeEvent, normalizeTask, type ApiEventShape } from '@/lib/schema';
import type { Agent, ApiEnvelope, Event, Task } from '@/types/models';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';
const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface SnapshotPayload {
  type: 'snapshot' | 'state_changed';
  data: {
    snapshot: {
      agents: Agent[];
      tasks: Task[];
      events: ApiEventShape[];
    };
  };
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { cache: 'no-store' });
  const json = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message ?? `Request failed: ${response.status}`);
  }

  return json.data;
}

function connectRealDashboardWs(onMessage: (payload: SnapshotPayload) => void): WebSocket {
  const socket = new WebSocket(wsUrl);

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as SnapshotPayload;
      onMessage(payload);
    } catch {
      // Ignore malformed messages and keep stream alive.
    }
  };

  return socket;
}

async function loadMockAgents(): Promise<Agent[]> {
  await sleep(120);
  return mockAgents;
}

async function loadMockTasks(): Promise<Task[]> {
  await sleep(140);
  return mockTasks;
}

async function loadMockEvents(): Promise<Event[]> {
  await sleep(100);
  return mockEvents;
}

function withLocalFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  return primary().catch(() => fallback());
}

function normalizeAgents(agents: Agent[]): Agent[] {
  return agents.map(normalizeAgent);
}

function normalizeTasks(tasks: Task[]): Task[] {
  return tasks.map(normalizeTask);
}

function normalizeEvents(events: ApiEventShape[]): Event[] {
  return events.map(normalizeEvent);
}

export interface RuntimeAdapter {
  mode: RuntimeMode;
  fetchAgents: () => Promise<Agent[]>;
  fetchTasks: () => Promise<Task[]>;
  fetchEvents: () => Promise<Event[]>;
  connectDashboardWs: (onMessage: (payload: SnapshotPayload) => void) => WebSocket;
}

function createMockSocket(onMessage: (payload: SnapshotPayload) => void): WebSocket {
  const socket = {
    readyState: WebSocket.CONNECTING,
    onerror: null,
    onclose: null,
    onopen: null,
    close: () => {
      if (socket.onclose) socket.onclose({} as CloseEvent);
    }
  } as unknown as WebSocket;

  queueMicrotask(() => {
    if (socket.onopen) socket.onopen({} as globalThis.Event);

    onMessage({
      type: 'snapshot',
      data: {
        snapshot: {
          agents: mockAgents,
          tasks: mockTasks,
          events: mockEvents
        }
      }
    });
  });

  return socket;
}

export function createRuntimeAdapter(mode: RuntimeMode = getRuntimeMode()): RuntimeAdapter {
  const realFetchAgents = async () => normalizeAgents(await apiGet<Agent[]>('/agents'));
  const realFetchTasks = async () => normalizeTasks(await apiGet<Task[]>('/tasks'));
  const realFetchEvents = async () => normalizeEvents(await apiGet<ApiEventShape[]>('/events?limit=100'));

  if (mode === 'mock') {
    return {
      mode,
      fetchAgents: loadMockAgents,
      fetchTasks: loadMockTasks,
      fetchEvents: loadMockEvents,
      connectDashboardWs: createMockSocket
    };
  }

  if (mode === 'local') {
    return {
      mode,
      fetchAgents: () => withLocalFallback(realFetchAgents, loadMockAgents),
      fetchTasks: () => withLocalFallback(realFetchTasks, loadMockTasks),
      fetchEvents: () => withLocalFallback(realFetchEvents, loadMockEvents),
      connectDashboardWs: connectRealDashboardWs
    };
  }

  return {
    mode,
    fetchAgents: realFetchAgents,
    fetchTasks: realFetchTasks,
    fetchEvents: realFetchEvents,
    connectDashboardWs: connectRealDashboardWs
  };
}
