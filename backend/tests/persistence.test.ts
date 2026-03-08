import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { MockStore } from '../src/store/mockStore';
import { JsonFilePersistence, PersistedRuntimeData } from '../src/store/jsonPersistence';

function readPersisted(filePath: string): PersistedRuntimeData {
  return JSON.parse(readFileSync(filePath, 'utf8')) as PersistedRuntimeData;
}

test('mock store persists runtime snapshot and transition history when persistence is enabled', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'clawville-persist-'));
  const filePath = path.join(dir, 'runtime-state.json');

  const store = new MockStore(new JsonFilePersistence(filePath));
  const createdTask = store.addTask({ title: 'Persist me', priority: 'high' });
  store.updateTaskStatus(createdTask.id, 'in_progress');
  await store.flush();

  const persisted = readPersisted(filePath);
  const persistedTask = persisted.snapshot.tasks.find((task) => task.id === createdTask.id);

  assert.ok(persistedTask);
  assert.equal(persistedTask?.status, 'in_progress');
  assert.equal(persisted.history.taskTransitions.length > 0, true);
});

test('mock store restores from persisted runtime state on startup', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'clawville-persist-'));
  const filePath = path.join(dir, 'runtime-state.json');
  const persistence = new JsonFilePersistence(filePath);

  const first = new MockStore(persistence);
  const createdAgent = first.addAgent({ name: 'Persisted Agent', role: 'Operator' });
  await first.flush();

  const restored = new MockStore(persistence);
  const found = restored.listAgents().find((agent) => agent.id === createdAgent.id);

  assert.ok(found);
  assert.equal(found?.name, 'Persisted Agent');
});

test('mock store trims persisted events and history to configured retention limits', async () => {
  process.env.RUNTIME_MAX_EVENTS = '3';
  process.env.RUNTIME_MAX_TASK_TRANSITIONS = '2';
  process.env.RUNTIME_MAX_AGENT_STATUS_CHANGES = '2';

  try {
    const dir = mkdtempSync(path.join(tmpdir(), 'clawville-persist-'));
    const filePath = path.join(dir, 'runtime-state.json');

    const store = new MockStore(new JsonFilePersistence(filePath));
    const createdTask = store.addTask({ title: 'Retention task', priority: 'high' });

    store.updateTaskStatus(createdTask.id, 'in_progress');
    store.updateTaskStatus(createdTask.id, 'blocked');
    store.updateTaskStatus(createdTask.id, 'done');
    store.pauseAgent('a-1');
    store.resumeAgent('a-1');
    store.pauseAgent('a-1');
    await store.flush();

    const persisted = readPersisted(filePath);

    assert.equal(persisted.snapshot.events.length, 3);
    assert.equal(persisted.history.taskTransitions.length, 2);
    assert.equal(persisted.history.agentStatusChanges.length, 2);
  } finally {
    delete process.env.RUNTIME_MAX_EVENTS;
    delete process.env.RUNTIME_MAX_TASK_TRANSITIONS;
    delete process.env.RUNTIME_MAX_AGENT_STATUS_CHANGES;
  }
});
