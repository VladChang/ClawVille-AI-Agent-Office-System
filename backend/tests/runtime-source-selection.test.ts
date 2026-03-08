import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OpenClawRuntimeSource,
  OpenClawStubRuntimeClient,
  RuntimeSourceUnavailableError
} from '../src/runtime/openclawRuntimeSource';
import { MockRuntimeSource } from '../src/runtime/mockRuntimeSource';
import { MockStore } from '../src/store/mockStore';
import { createRuntimeSourceForMode, resolveRuntimeSourceMode } from '../src/runtime';

test('resolveRuntimeSourceMode defaults safely to mock', () => {
  assert.equal(resolveRuntimeSourceMode(undefined), 'mock');
  assert.equal(resolveRuntimeSourceMode('invalid'), 'mock');
  assert.equal(resolveRuntimeSourceMode('mock'), 'mock');
  assert.equal(resolveRuntimeSourceMode('openclaw'), 'openclaw');
});

test('createRuntimeSourceForMode binds expected implementation', () => {
  const mock = createRuntimeSourceForMode('mock');
  const openclaw = createRuntimeSourceForMode('openclaw');

  assert.equal(mock instanceof MockRuntimeSource, true);
  assert.equal(openclaw instanceof OpenClawRuntimeSource, true);
});

test('openclaw runtime throws explicit not-configured error when fallback disabled', async () => {
  const source = new OpenClawRuntimeSource({
    client: new OpenClawStubRuntimeClient('client-unavailable'),
    fallback: new MockRuntimeSource(new MockStore()),
    allowFallback: false
  });

  await assert.rejects(
    () => source.listAgents(),
    (error: unknown) => {
      assert.equal(error instanceof RuntimeSourceUnavailableError, true);
      assert.match((error as Error).message, /RUNTIME_NOT_CONFIGURED/);
      return true;
    }
  );
});

test('openclaw runtime may fallback to mock when ALLOW_RUNTIME_FALLBACK behavior is enabled', () => {
  const fallback = new MockRuntimeSource(new MockStore());
  const source = new OpenClawRuntimeSource({
    client: new OpenClawStubRuntimeClient('client-unavailable'),
    fallback,
    allowFallback: true
  });

  const beforePromise = source.listAgents();
  const addPromise = source.addAgent({ name: 'Fallback Agent', role: 'Ops' });
  const afterPromise = Promise.all([beforePromise, addPromise]).then(async ([before]) => {
    const after = await source.listAgents();
    return { before, after };
  });

  return afterPromise.then(({ before, after }) => {
    assert.equal(after.length, before.length + 1);
  });
});
