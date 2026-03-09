import { RuntimeSource } from './runtimeSource';
import { MockStore, store } from '../store/mockStore';

export class MockRuntimeSource implements RuntimeSource {
  constructor(private readonly mockStore: MockStore) {}

  async getOverview() {
    return this.mockStore.getOverview();
  }

  async getSnapshot() {
    return this.mockStore.getSnapshot();
  }

  async listAgents() {
    return this.mockStore.listAgents();
  }

  async listTasks() {
    return this.mockStore.listTasks();
  }

  async listEvents(limit?: number) {
    return this.mockStore.listEvents(limit);
  }

  async addAgent(payload: Parameters<MockStore['addAgent']>[0]) {
    return this.mockStore.addAgent(payload);
  }

  async pauseAgent(agentId: string) {
    return this.mockStore.pauseAgent(agentId);
  }

  async resumeAgent(agentId: string) {
    return this.mockStore.resumeAgent(agentId);
  }

  async updateAgentDisplayName(agentId: string, displayName: string | null) {
    return this.mockStore.updateAgentDisplayName(agentId, displayName);
  }

  async addTask(payload: Parameters<MockStore['addTask']>[0]) {
    return this.mockStore.addTask(payload);
  }

  async updateTaskStatus(taskId: string, status: Parameters<MockStore['updateTaskStatus']>[1]) {
    return this.mockStore.updateTaskStatus(taskId, status);
  }

  async retryTask(taskId: string) {
    return this.mockStore.retryTask(taskId);
  }

  onStateChange(listener: Parameters<MockStore['onStateChange']>[0]) {
    return this.mockStore.onStateChange(listener);
  }

  updateRandomState() {
    return this.mockStore.updateRandomState();
  }
}

export const mockRuntimeSource = new MockRuntimeSource(store);
