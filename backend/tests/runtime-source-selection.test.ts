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

test('openclaw runtime throws explicit not-configured error when fallback disabled', () => {
  const source = new OpenClawRuntimeSource({
    client: new OpenClawStubRuntimeClient('client-unavailable'),
    fallback: new MockRuntimeSource(new MockStore()),
    allowFallback: false
  });

  assert.throws(
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

  const before = source.listAgents().length;
  source.addAgent({ name: 'Fallback Agent', role: 'Ops' });
  const after = source.listAgents().length;

  assert.equal(after, before + 1);
});
