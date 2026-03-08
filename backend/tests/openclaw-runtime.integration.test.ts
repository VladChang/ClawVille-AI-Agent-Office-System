import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { FixtureRuntimeTransport } from '../src/runtime/openclawTransport';
import { OpenClawRuntimeSource, OpenClawTransportRuntimeClient, RuntimeSourceUnavailableError } from '../src/runtime/openclawRuntimeSource';
import { MockRuntimeSource } from '../src/runtime/mockRuntimeSource';
import { MockStore } from '../src/store/mockStore';

function fixturePath() {
  return path.resolve(process.cwd(), 'tests/fixtures/openclaw-runtime-fixture.json');
}

function fixtureJson() {
  return JSON.parse(readFileSync(fixturePath(), 'utf8')) as object;
}


test('openclaw transport fixture maps payload into dashboard schema and filters malformed entries', () => {
  const transport = new FixtureRuntimeTransport(fixtureJson());
  const source = new OpenClawRuntimeSource({
    client: new OpenClawTransportRuntimeClient(transport),
    fallback: new MockRuntimeSource(new MockStore()),
    allowFallback: false
  });

  return source.getSnapshot().then((snapshot) => {
    assert.equal(snapshot.agents.length, 1);
    assert.equal(snapshot.agents[0]?.id, 'oc-a-1');
    assert.equal(snapshot.tasks.length, 2);
    assert.equal(snapshot.tasks[1]?.status, 'todo');
    assert.equal(snapshot.tasks[1]?.priority, 'medium');
    assert.equal(snapshot.events.length, 1);
    assert.equal(snapshot.events[0]?.id, 'oc-e-1');
    assert.equal(snapshot.events[0]?.level, 'info');

    assert.equal(snapshot.overview.counts.agents, 1);
    assert.equal(snapshot.overview.counts.tasks, 2);
    assert.equal(snapshot.overview.counts.events, 1);
  });
});

test('openclaw runtime remains strict when unavailable and fallback is disabled', async () => {
  const source = new OpenClawRuntimeSource({
    fallback: new MockRuntimeSource(new MockStore()),
    allowFallback: false
  });

  await assert.rejects(
    () => source.getSnapshot(),
    (error: unknown) => {
      assert.equal(error instanceof RuntimeSourceUnavailableError, true);
      assert.match((error as Error).message, /RUNTIME_NOT_CONFIGURED/);
      return true;
    }
  );
});

test('openclaw state-change subscription stays schema-consistent with snapshot/list operations', async () => {
  const transport = new FixtureRuntimeTransport(fixtureJson());
  const source = new OpenClawRuntimeSource({
    client: new OpenClawTransportRuntimeClient(transport),
    fallback: new MockRuntimeSource(new MockStore()),
    allowFallback: false
  });

  let stateChangedPayload:
    | {
        snapshot: { agents: Array<{ id: string; status: string }> };
        eventLevel?: string;
      }
    | undefined;

  const unsubscribe = source.onStateChange(({ snapshot, event }) => {
    stateChangedPayload = {
      snapshot: {
        agents: snapshot.agents.map((agent) => ({ id: agent.id, status: agent.status }))
      },
      eventLevel: event?.level
    };
  });

  await source.pauseAgent('oc-a-1');

  for (let i = 0; i < 10 && !stateChangedPayload; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  const apiAfterShape = (await source.listAgents()).map((agent) => ({ id: agent.id, status: agent.status }));
  const changedAgent = stateChangedPayload?.snapshot.agents.find((agent) => agent.id === 'oc-a-1');
  const listedAgent = apiAfterShape.find((agent) => agent.id === 'oc-a-1');

  assert.ok(stateChangedPayload, 'expected state-change payload from runtime subscription');
  assert.equal(changedAgent?.status, 'offline');
  assert.equal(listedAgent?.status, 'offline');
  assert.equal(stateChangedPayload?.eventLevel, 'warning');

  unsubscribe();
});
