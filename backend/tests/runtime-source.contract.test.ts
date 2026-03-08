import test from 'node:test';
import assert from 'node:assert/strict';
import { MockStore } from '../src/store/mockStore';
import { MockRuntimeSource } from '../src/runtime/mockRuntimeSource';

test('MockRuntimeSource honors runtime source contract for snapshot/list/control + state change', async () => {
  const source = new MockRuntimeSource(new MockStore());

  const snapshotBefore = source.getSnapshot();
  assert.equal(Array.isArray(snapshotBefore.agents), true);
  assert.equal(Array.isArray(snapshotBefore.tasks), true);
  assert.equal(Array.isArray(snapshotBefore.events), true);
  assert.equal(snapshotBefore.events.every((event) => typeof event.level === 'string'), true);

  const agent = source.addAgent({ name: 'Contract Agent', role: 'QA' });
  const paused = source.pauseAgent(agent.id);
  assert.equal(paused?.status, 'offline');
  const resumed = source.resumeAgent(agent.id);
  assert.equal(resumed?.status, 'idle');

  const task = source.addTask({ title: 'Contract Task', priority: 'medium', status: 'blocked' });
  const retried = source.retryTask(task.id);
  assert.equal(retried?.status, 'in_progress');

  let seenStateChanged = false;
  const unsubscribe = source.onStateChange(({ snapshot, event }) => {
    seenStateChanged = true;
    assert.equal(Array.isArray(snapshot.agents), true);
    assert.equal(typeof event?.type, 'string');
    assert.equal(event?.level, 'error');
  });

  source.updateTaskStatus(task.id, 'blocked');
  unsubscribe();

  assert.equal(seenStateChanged, true);
});
