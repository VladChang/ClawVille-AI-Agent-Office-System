import test from 'node:test';
import assert from 'node:assert/strict';
import { MockRuntimeSource } from '../src/runtime/mockRuntimeSource';
import { MockStore } from '../src/store/mockStore';
import { createRealtimeSnapshotPayload, createRealtimeStateChangedPayload } from '../src/realtime/realtimeContract';
import { resolveRealtimeSocket } from '../src/realtime/websocket';

test('realtime websocket payload builders keep the expected envelope shape', async () => {
  const runtimeSource = new MockRuntimeSource(new MockStore());
  const snapshot = await runtimeSource.getSnapshot();
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

test('realtime websocket handler accepts both fastify connection shapes', () => {
  const socket = {
    readyState: 1,
    send() {},
    on() {}
  };

  assert.equal(resolveRealtimeSocket(socket), socket);
  assert.equal(resolveRealtimeSocket({ socket }), socket);
});
