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

test('mock store persists runtime snapshot and transition history when persistence is enabled', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'clawville-persist-'));
  const filePath = path.join(dir, 'runtime-state.json');

  const store = new MockStore(new JsonFilePersistence(filePath));
  const createdTask = store.addTask({ title: 'Persist me', priority: 'high' });
  store.updateTaskStatus(createdTask.id, 'in_progress');

  const persisted = readPersisted(filePath);
  const persistedTask = persisted.snapshot.tasks.find((task) => task.id === createdTask.id);

  assert.ok(persistedTask);
  assert.equal(persistedTask?.status, 'in_progress');
  assert.equal(persisted.history.taskTransitions.length > 0, true);
});

test('mock store restores from persisted runtime state on startup', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'clawville-persist-'));
  const filePath = path.join(dir, 'runtime-state.json');
  const persistence = new JsonFilePersistence(filePath);

  const first = new MockStore(persistence);
  const createdAgent = first.addAgent({ name: 'Persisted Agent', role: 'Operator' });

  const restored = new MockStore(persistence);
  const found = restored.listAgents().find((agent) => agent.id === createdAgent.id);

  assert.ok(found);
  assert.equal(found?.name, 'Persisted Agent');
});
