import { createRuntimeAdapter, type SnapshotPayload } from '@/lib/runtimeAdapter';
import { getOperatorHeaders } from '@/lib/operator';
import type { RuntimeMode } from '@/lib/runtime';
import type { Agent, Event, RuntimeStatusSnapshot, Task } from '@/types/models';

const runtime = createRuntimeAdapter();

export async function fetchAgents(): Promise<Agent[]> {
  return runtime.fetchAgents();
}

export async function fetchTasks(): Promise<Task[]> {
  return runtime.fetchTasks();
}

export async function fetchEvents(): Promise<Event[]> {
  return runtime.fetchEvents();
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

async function apiRequest<T>(path: string, method: 'POST' | 'PATCH', body?: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getOperatorHeaders()
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const json = (await response.json()) as { success: boolean; data: T; error?: { message?: string } };

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message ?? `Request failed: ${response.status}`);
  }

  return json.data;
}

export function getConfiguredRuntimeMode(): RuntimeMode {
  return runtime.mode;
}

export async function pauseAgent(agentId: string): Promise<Agent> {
  return apiRequest<Agent>(`/agents/${agentId}/pause`, 'POST');
}

export async function resumeAgent(agentId: string): Promise<Agent> {
  return apiRequest<Agent>(`/agents/${agentId}/resume`, 'POST');
}

export async function retryTask(taskId: string): Promise<Task> {
  return apiRequest<Task>(`/tasks/${taskId}/retry`, 'POST');
}

export async function updateAgentDisplayName(agentId: string, displayName: string | null): Promise<Agent> {
  return apiRequest<Agent>(`/agents/${agentId}`, 'PATCH', { displayName });
}

export async function fetchRuntimeStatus(): Promise<RuntimeStatusSnapshot> {
  const response = await fetch(`${apiBaseUrl}/runtime/status`, {
    headers: getOperatorHeaders(),
    cache: 'no-store'
  });
  const json = (await response.json()) as { success: boolean; data: RuntimeStatusSnapshot; error?: { message?: string } };

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message ?? `Request failed: ${response.status}`);
  }

  return json.data;
}

export function connectDashboardWs(onMessage: (payload: SnapshotPayload) => void): WebSocket {
  return runtime.connectDashboardWs(onMessage);
}
