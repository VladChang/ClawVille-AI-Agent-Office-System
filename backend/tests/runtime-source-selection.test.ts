import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenClawRuntimeSource } from '../src/runtime/openclawRuntimeSource';
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

test('OpenClawRuntimeSource round-1 placeholder proxies to fallback runtime', () => {
  const fallback = new MockRuntimeSource(new MockStore());
  const source = new OpenClawRuntimeSource(fallback);

  const before = source.listAgents().length;
  const created = source.addAgent({ name: 'Proxy Agent', role: 'Proxy' });
  const after = source.listAgents().length;

  assert.equal(typeof created.id, 'string');
  assert.equal(after, before + 1);
});
