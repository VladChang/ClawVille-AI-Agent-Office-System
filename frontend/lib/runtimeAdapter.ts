import { mockAgents, mockEvents, mockTasks } from '@/lib/mockData';
import {
  mapRuntimeAgents,
  mapRuntimeEvents,
  mapRuntimeTasks,
  parseApiEnvelopeData,
  parseRuntimeRealtimeEnvelope
} from '@/lib/runtimeContract';
import { getRuntimeMode, type RuntimeMode } from '@/lib/runtime';
import type { Agent, Event, Task } from '@/types/models';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';
const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface SnapshotPayload {
  type: 'snapshot' | 'state_changed';
  data: {
    snapshot: {
      agents: Agent[];
      tasks: Task[];
      events: Event[];
    };
  };
}

async function apiGet<T>(path: string, mapper: (data: unknown) => T): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { cache: 'no-store' });
  const json = (await response.json()) as unknown;

  if (!response.ok) {
    if (typeof json === 'object' && json !== null && 'error' in json) {
      const error = (json as { error?: { message?: string } }).error;
      throw new Error(error?.message ?? `Request failed: ${response.status}`);
    }
    throw new Error(`Request failed: ${response.status}`);
  }

  return parseApiEnvelopeData(json, mapper);
}

function connectRealDashboardWs(onMessage: (payload: SnapshotPayload) => void): WebSocket {
  const socket = new WebSocket(wsUrl);

  socket.onmessage = (event) => {
    try {
      const parsed = parseRuntimeRealtimeEnvelope(JSON.parse(event.data));
      if (!parsed) return;
      onMessage(parsed);
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
  const realFetchAgents = async () => apiGet('/agents', mapRuntimeAgents);
  const realFetchTasks = async () => apiGet('/tasks', mapRuntimeTasks);
  const realFetchEvents = async () => apiGet('/events?limit=100', mapRuntimeEvents);

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
