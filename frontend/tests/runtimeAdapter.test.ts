import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeAdapter, isRealModeStrictError } from '../lib/runtimeAdapter';

test('real runtime mode surfaces strict error when backend fetch fails', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:3001');
  }) as typeof fetch;

  try {
    const adapter = createRuntimeAdapter('real');

    await assert.rejects(
      () => adapter.fetchAgents(),
      (error: unknown) => {
        assert.equal(isRealModeStrictError(error), true);
        assert.match(
          (error as Error).message,
          /Real mode does not allow mock\/local fallback/i
        );
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('local runtime mode still falls back to mock data when backend fetch fails', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:3001');
  }) as typeof fetch;

  try {
    const adapter = createRuntimeAdapter('local');
    const agents = await adapter.fetchAgents();
    assert.equal(agents.length > 0, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
