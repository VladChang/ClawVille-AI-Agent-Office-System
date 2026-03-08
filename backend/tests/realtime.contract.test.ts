import test from 'node:test';
import assert from 'node:assert/strict';
import { MockRuntimeSource } from '../src/runtime/mockRuntimeSource';
import { MockStore } from '../src/store/mockStore';
import { createRealtimeSnapshotPayload, createRealtimeStateChangedPayload } from '../src/realtime/realtimeContract';

test('realtime websocket payload builders keep the expected envelope shape', () => {
  const runtimeSource = new MockRuntimeSource(new MockStore());
  const snapshot = runtimeSource.getSnapshot();
  const event = snapshot.events[0];

  const initialPayload = createRealtimeSnapshotPayload(snapshot);
  assert.equal(initialPayload.type, 'snapshot');
  assert.equal(initialPayload.data.snapshot.overview.counts.agents, snapshot.agents.length);
  assert.deepEqual(Object.keys(initialPayload.data.snapshot.overview.agentsByStatus).sort(), ['busy', 'idle', 'offline']);
  assert.deepEqual(Object.keys(initialPayload.data.snapshot.overview.tasksByStatus).sort(), ['blocked', 'done', 'in_progress', 'todo']);

  const changedPayload = createRealtimeStateChangedPayload(snapshot, event);
  assert.equal(changedPayload.type, 'state_changed');
  assert.equal(changedPayload.data.snapshot.overview.counts.events, snapshot.events.length);
  assert.equal(changedPayload.data.event?.id, event?.id);
});
