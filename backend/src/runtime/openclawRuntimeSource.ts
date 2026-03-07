import { RuntimeSource } from './runtimeSource';
import { MockRuntimeSource, mockRuntimeSource } from './mockRuntimeSource';

/**
 * Round 1 placeholder adapter.
 *
 * TODO(round-2): Replace proxy behavior with real OpenClaw runtime reads/writes
 * while preserving RuntimeSource contract + API/WS envelopes.
 */
export class OpenClawRuntimeSource implements RuntimeSource {
  constructor(private readonly fallback: RuntimeSource = mockRuntimeSource) {}

  private passthrough<T>(operation: string, fn: () => T): T {
    // Keep this warning visible so we do not accidentally treat this as full integration.
    // Log once per operation call to preserve explicit TODO boundary in runtime logs.
    console.warn(`[runtime][openclaw][round-1] ${operation} is proxied to mock fallback`);
    return fn();
  }

  getOverview() {
    return this.passthrough('getOverview', () => this.fallback.getOverview());
  }

  getSnapshot() {
    return this.passthrough('getSnapshot', () => this.fallback.getSnapshot());
  }

  listAgents() {
    return this.passthrough('listAgents', () => this.fallback.listAgents());
  }

  listTasks() {
    return this.passthrough('listTasks', () => this.fallback.listTasks());
  }

  listEvents(limit?: number) {
    return this.passthrough('listEvents', () => this.fallback.listEvents(limit));
  }

  addAgent(payload: Parameters<MockRuntimeSource['addAgent']>[0]) {
    return this.passthrough('addAgent', () => this.fallback.addAgent(payload));
  }

  pauseAgent(agentId: string) {
    return this.passthrough('pauseAgent', () => this.fallback.pauseAgent(agentId));
  }

  resumeAgent(agentId: string) {
    return this.passthrough('resumeAgent', () => this.fallback.resumeAgent(agentId));
  }

  addTask(payload: Parameters<MockRuntimeSource['addTask']>[0]) {
    return this.passthrough('addTask', () => this.fallback.addTask(payload));
  }

  updateTaskStatus(taskId: string, status: Parameters<MockRuntimeSource['updateTaskStatus']>[1]) {
    return this.passthrough('updateTaskStatus', () => this.fallback.updateTaskStatus(taskId, status));
  }

  retryTask(taskId: string) {
    return this.passthrough('retryTask', () => this.fallback.retryTask(taskId));
  }

  onStateChange(listener: Parameters<MockRuntimeSource['onStateChange']>[0]) {
    return this.passthrough('onStateChange', () => this.fallback.onStateChange(listener));
  }

  updateRandomState() {
    return this.passthrough('updateRandomState', () => this.fallback.updateRandomState());
  }
}
