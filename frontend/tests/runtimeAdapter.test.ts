import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntimeAdapter,
  INVALID_REALTIME_PAYLOAD_CLOSE_CODE,
  INVALID_REALTIME_PAYLOAD_CLOSE_REASON,
  isRealModeStrictError,
  isRuntimeNotConfiguredError
} from '../lib/runtimeAdapter';

class MockRealtimeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockRealtimeWebSocket[] = [];

  readyState = MockRealtimeWebSocket.OPEN;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  lastClose: { code: number; reason: string } | null = null;

  constructor(public readonly url: string) {
    MockRealtimeWebSocket.instances.push(this);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockRealtimeWebSocket.CLOSED;
    this.lastClose = { code: code ?? 1000, reason: reason ?? '' };
    this.onclose?.({ code: this.lastClose.code, reason: this.lastClose.reason } as CloseEvent);
  }

  emitMessage(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

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

test('real runtime websocket closes fast on malformed JSON payloads', () => {
  const originalWebSocket = globalThis.WebSocket;
  const originalConsoleError = console.error;
  const capturedErrors: string[] = [];

  globalThis.WebSocket = MockRealtimeWebSocket as unknown as typeof WebSocket;
  console.error = (...args: unknown[]) => {
    capturedErrors.push(args.map((value) => String(value)).join(' '));
  };

  try {
    const adapter = createRuntimeAdapter('real');
    let messageCount = 0;
    adapter.connectDashboardWs(() => {
      messageCount += 1;
    });

    const socket = MockRealtimeWebSocket.instances.at(-1);
    assert.ok(socket);

    socket?.emitMessage('{bad-json');

    assert.equal(messageCount, 0);
    assert.deepEqual(socket?.lastClose, {
      code: INVALID_REALTIME_PAYLOAD_CLOSE_CODE,
      reason: INVALID_REALTIME_PAYLOAD_CLOSE_REASON
    });
    assert.equal(capturedErrors.some((entry) => entry.includes('Invalid realtime payload')), true);
  } finally {
    globalThis.WebSocket = originalWebSocket;
    console.error = originalConsoleError;
    MockRealtimeWebSocket.instances = [];
  }
});

test('real runtime websocket closes fast on contract drift payloads', () => {
  const originalWebSocket = globalThis.WebSocket;
  const originalConsoleError = console.error;
  const capturedErrors: string[] = [];

  globalThis.WebSocket = MockRealtimeWebSocket as unknown as typeof WebSocket;
  console.error = (...args: unknown[]) => {
    capturedErrors.push(args.map((value) => String(value)).join(' '));
  };

  try {
    const adapter = createRuntimeAdapter('real');
    let messageCount = 0;
    adapter.connectDashboardWs(() => {
      messageCount += 1;
    });

    const socket = MockRealtimeWebSocket.instances.at(-1);
    assert.ok(socket);

    socket?.emitMessage(
      JSON.stringify({
        type: 'snapshot',
        data: {
          snapshot: {
            agents: [],
            tasks: [],
            events: []
          }
        }
      })
    );

    assert.equal(messageCount, 0);
    assert.deepEqual(socket?.lastClose, {
      code: INVALID_REALTIME_PAYLOAD_CLOSE_CODE,
      reason: INVALID_REALTIME_PAYLOAD_CLOSE_REASON
    });
    assert.equal(capturedErrors.some((entry) => entry.includes('expected contract')), true);
  } finally {
    globalThis.WebSocket = originalWebSocket;
    console.error = originalConsoleError;
    MockRealtimeWebSocket.instances = [];
  }
});
