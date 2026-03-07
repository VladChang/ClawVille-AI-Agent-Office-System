import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeAdapter, isRealModeStrictError, isRuntimeNotConfiguredError } from '../lib/runtimeAdapter';

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
        assert.match((error as Error).message, /Real mode does not allow mock\/local fallback/i);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('real runtime mode preserves runtime-not-configured backend signal', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    ({
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        error: {
          code: 'RUNTIME_NOT_CONFIGURED',
          message: '[RUNTIME_NOT_CONFIGURED] OpenClaw runtime client is not configured.'
        }
      })
    }) as Response) as typeof fetch;

  try {
    const adapter = createRuntimeAdapter('real');

    await assert.rejects(
      () => adapter.fetchAgents(),
      (error: unknown) => {
        assert.equal(isRealModeStrictError(error), true);
        assert.equal(isRuntimeNotConfiguredError(error), true);
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
