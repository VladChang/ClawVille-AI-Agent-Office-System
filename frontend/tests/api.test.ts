import test from 'node:test';
import assert from 'node:assert/strict';
import { pauseAgent } from '../lib/api';

test('mutation requests include operator headers', async () => {
  const originalFetch = globalThis.fetch;
  const originalOperatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  const originalOperatorRole = process.env.NEXT_PUBLIC_OPERATOR_ROLE;
  let capturedInit: RequestInit | undefined;

  process.env.NEXT_PUBLIC_OPERATOR_ID = 'ui-operator';
  process.env.NEXT_PUBLIC_OPERATOR_ROLE = 'admin';

  globalThis.fetch = (async (_input, init) => {
    capturedInit = init;

    return {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: 'a-1',
          name: 'Nova',
          role: 'Planner',
          status: 'offline',
          updatedAt: '2026-03-08T00:00:00.000Z'
        }
      }),
      status: 200,
      headers: new Headers()
    } as Response;
  }) as typeof fetch;

  try {
    await pauseAgent('a-1');
    assert.ok(capturedInit);
    const headers = capturedInit?.headers as Record<string, string>;
    assert.equal(headers['x-operator-id'], 'ui-operator');
    assert.equal(headers['x-operator-role'], 'admin');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOperatorId === undefined) delete process.env.NEXT_PUBLIC_OPERATOR_ID;
    else process.env.NEXT_PUBLIC_OPERATOR_ID = originalOperatorId;
    if (originalOperatorRole === undefined) delete process.env.NEXT_PUBLIC_OPERATOR_ROLE;
    else process.env.NEXT_PUBLIC_OPERATOR_ROLE = originalOperatorRole;
  }
});
