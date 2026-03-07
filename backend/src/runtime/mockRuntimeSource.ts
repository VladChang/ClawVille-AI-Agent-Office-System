import { RuntimeSource } from './runtimeSource';
import { MockStore, store } from '../store/mockStore';

export class MockRuntimeSource implements RuntimeSource {
  constructor(private readonly mockStore: MockStore) {}

  getOverview() {
    return this.mockStore.getOverview();
  }

  getSnapshot() {
    return this.mockStore.getSnapshot();
  }

  listAgents() {
    return this.mockStore.listAgents();
  }

  listTasks() {
    return this.mockStore.listTasks();
  }

  listEvents(limit?: number) {
    return this.mockStore.listEvents(limit);
  }

  addAgent(payload: Parameters<MockStore['addAgent']>[0]) {
    return this.mockStore.addAgent(payload);
  }

  pauseAgent(agentId: string) {
    return this.mockStore.pauseAgent(agentId);
  }

  resumeAgent(agentId: string) {
    return this.mockStore.resumeAgent(agentId);
  }

  addTask(payload: Parameters<MockStore['addTask']>[0]) {
    return this.mockStore.addTask(payload);
  }

  updateTaskStatus(taskId: string, status: Parameters<MockStore['updateTaskStatus']>[1]) {
    return this.mockStore.updateTaskStatus(taskId, status);
  }

  retryTask(taskId: string) {
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
