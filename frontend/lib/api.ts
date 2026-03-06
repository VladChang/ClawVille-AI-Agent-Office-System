import { mockAgents, mockEvents, mockTasks } from '@/lib/mockData';
import type { Agent, ApiEnvelope, Event, Task } from '@/types/models';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';
const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws';
const useMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toEventLevel(type: string): Event['level'] {
  if (type.includes('blocked') || type.includes('error')) return 'error';
  if (type.includes('paused') || type.includes('retry')) return 'warning';
  return 'info';
}

function normalizeEvent(event: Omit<Event, 'level'> & Partial<Pick<Event, 'level'>>): Event {
  return {
    ...event,
    level: event.level ?? toEventLevel(event.type)
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

async function apiPost<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const json = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message ?? `Request failed: ${response.status}`);
  }

  return json.data;
}

export async function fetchAgents(): Promise<Agent[]> {
  if (useMockApi) {
    await sleep(120);
    return mockAgents;
  }

  try {
    return await apiGet<Agent[]>('/agents');
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      return mockAgents;
    }
    throw error;
  }
}

export async function fetchTasks(): Promise<Task[]> {
  if (useMockApi) {
    await sleep(140);
    return mockTasks;
  }

  try {
    return await apiGet<Task[]>('/tasks');
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      return mockTasks;
    }
    throw error;
  }
}

export async function fetchEvents(): Promise<Event[]> {
  if (useMockApi) {
    await sleep(100);
    return mockEvents;
  }

  try {
    const events = await apiGet<Array<Omit<Event, 'level'> & Partial<Pick<Event, 'level'>>>>('/events?limit=100');
    return events.map(normalizeEvent);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      return mockEvents;
    }
    throw error;
  }
}

export async function pauseAgent(agentId: string): Promise<Agent> {
  return apiPost<Agent>(`/agents/${agentId}/pause`);
}

export async function resumeAgent(agentId: string): Promise<Agent> {
  return apiPost<Agent>(`/agents/${agentId}/resume`);
}

export async function retryTask(taskId: string): Promise<Task> {
  return apiPost<Task>(`/tasks/${taskId}/retry`);
}

export function connectDashboardWs(onMessage: (payload: {
  type: 'snapshot' | 'state_changed';
  data: {
    snapshot: {
      agents: Agent[];
      tasks: Task[];
      events: Event[];
    };
  };
}) => void): WebSocket {
  const socket = new WebSocket(wsUrl);

  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data) as {
      type: 'snapshot' | 'state_changed';
      data: {
        snapshot: {
          agents: Agent[];
          tasks: Task[];
          events: Array<Omit<Event, 'level'> & Partial<Pick<Event, 'level'>>>;
        };
      };
    };

    onMessage({
      ...payload,
      data: {
        snapshot: {
          ...payload.data.snapshot,
          events: payload.data.snapshot.events.map(normalizeEvent)
        }
      }
    });
  };

  return socket;
}
