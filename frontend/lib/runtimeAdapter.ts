import { mockAgents, mockEvents, mockTasks } from '@/lib/mockData';
import {
  decodeRuntimeRealtimeEnvelope,
  mapRuntimeAgents,
  mapRuntimeEvents,
  mapRuntimeTasks,
  parseApiEnvelopeData
} from '@/lib/runtimeContract';
import { getRuntimeMode, type RuntimeMode } from '@/lib/runtime';
import type { Agent, DashboardSnapshot, Event, Task } from '@/types/models';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';
const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface SnapshotPayload {
  type: 'snapshot' | 'state_changed';
  data: {
    snapshot: DashboardSnapshot;
    event?: Event;
  };
}

const realModeErrorPrefix = '[Runtime mode: real]';
export const INVALID_REALTIME_PAYLOAD_CLOSE_CODE = 4000;
export const INVALID_REALTIME_PAYLOAD_CLOSE_REASON = 'INVALID_REALTIME_PAYLOAD';

function toRealModeStrictError(action: string, error: unknown): Error {
  const message =
    error instanceof Error
      ? error.message
      : `Unknown error while attempting to ${action} from configured runtime backend.`;

  return new Error(
    `${realModeErrorPrefix} Unable to ${action}. ` +
      `Real mode does not allow mock/local fallback. Verify backend availability and runtime wiring. Root cause: ${message}`
  );
}

export function isRealModeStrictError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith(realModeErrorPrefix);
}

export function isRuntimeNotConfiguredError(error: unknown): boolean {
  return error instanceof Error && /RUNTIME_NOT_CONFIGURED|not configured/i.test(error.message);
}

export function isInvalidRealtimePayloadCloseEvent(
  event: Pick<CloseEvent, 'code' | 'reason'> | null | undefined
): boolean {
  return (
    !!event &&
    (event.code === INVALID_REALTIME_PAYLOAD_CLOSE_CODE || event.reason === INVALID_REALTIME_PAYLOAD_CLOSE_REASON)
  );
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
      if (typeof event.data !== 'string') {
        console.error('[runtime][ws] Invalid realtime payload: WebSocket message must be text JSON.');
        socket.close(INVALID_REALTIME_PAYLOAD_CLOSE_CODE, INVALID_REALTIME_PAYLOAD_CLOSE_REASON);
        return;
      }

      const payload = JSON.parse(event.data) as unknown;
      const decoded = decodeRuntimeRealtimeEnvelope(payload);

      if (!decoded.ok) {
        console.error(`[runtime][ws] Invalid realtime payload: ${decoded.error.message}`);
        socket.close(INVALID_REALTIME_PAYLOAD_CLOSE_CODE, INVALID_REALTIME_PAYLOAD_CLOSE_REASON);
        return;
      }

      onMessage(decoded.envelope);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown JSON parsing failure.';
      console.error(`[runtime][ws] Invalid realtime payload: ${message}`);
      socket.close(INVALID_REALTIME_PAYLOAD_CLOSE_CODE, INVALID_REALTIME_PAYLOAD_CLOSE_REASON);
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

function withRealStrict<T>(action: string, operation: () => Promise<T>): Promise<T> {
  return operation().catch((error) => {
    throw toRealModeStrictError(action, error);
  });
}

export interface RuntimeAdapter {
  mode: RuntimeMode;
  fetchAgents: () => Promise<Agent[]>;
  fetchTasks: () => Promise<Task[]>;
  fetchEvents: () => Promise<Event[]>;
  connectDashboardWs: (onMessage: (payload: SnapshotPayload) => void) => WebSocket;
}

function createMockSocket(onMessage: (payload: SnapshotPayload) => void): WebSocket {
  type MockSocket = WebSocket & {
    readyState: number;
    onerror: WebSocket['onerror'];
    onclose: WebSocket['onclose'];
    onopen: WebSocket['onopen'];
  };

  const socket = {
    readyState: WebSocket.CONNECTING,
    onerror: null,
    onclose: null,
    onopen: null,
    close: (code?: number, reason?: string) => {
      socket.readyState = WebSocket.CLOSED;
      if (socket.onclose) socket.onclose({ code: code ?? 1000, reason: reason ?? '' } as CloseEvent);
    }
  } as MockSocket;

  queueMicrotask(() => {
    socket.readyState = WebSocket.OPEN;
    if (socket.onopen) socket.onopen({} as globalThis.Event);

    onMessage({
      type: 'snapshot',
      data: {
        snapshot: {
          overview: {
            generatedAt: new Date(0).toISOString(),
            counts: {
              agents: mockAgents.length,
              tasks: mockTasks.length,
              events: mockEvents.length,
              activeAgents: mockAgents.filter((agent) => agent.status === 'busy').length,
              openTasks: mockTasks.filter((task) => task.status !== 'done').length
            },
            agentsByStatus: {
              idle: mockAgents.filter((agent) => agent.status === 'idle').length,
              busy: mockAgents.filter((agent) => agent.status === 'busy').length,
              offline: mockAgents.filter((agent) => agent.status === 'offline').length
            },
            tasksByStatus: {
              todo: mockTasks.filter((task) => task.status === 'todo').length,
              in_progress: mockTasks.filter((task) => task.status === 'in_progress').length,
              blocked: mockTasks.filter((task) => task.status === 'blocked').length,
              done: mockTasks.filter((task) => task.status === 'done').length
            }
          },
          agents: mockAgents,
          tasks: mockTasks,
          events: mockEvents
        }
      }
    });
  });

  return socket as WebSocket;
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
    fetchAgents: () => withRealStrict('fetch agents', realFetchAgents),
    fetchTasks: () => withRealStrict('fetch tasks', realFetchTasks),
    fetchEvents: () => withRealStrict('fetch events', realFetchEvents),
    connectDashboardWs: connectRealDashboardWs
  };
}
