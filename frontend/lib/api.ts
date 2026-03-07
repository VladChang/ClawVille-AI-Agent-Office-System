import { createRuntimeAdapter, type SnapshotPayload } from '@/lib/runtimeAdapter';
import type { Agent, Event, Task } from '@/types/models';

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

async function apiPost<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const json = (await response.json()) as { success: boolean; data: T; error?: { message?: string } };

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message ?? `Request failed: ${response.status}`);
  }

  return json.data;
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

export function connectDashboardWs(onMessage: (payload: SnapshotPayload) => void): WebSocket {
  return runtime.connectDashboardWs(onMessage);
}
