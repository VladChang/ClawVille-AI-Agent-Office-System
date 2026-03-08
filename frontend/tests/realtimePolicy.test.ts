import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_INITIAL_REALTIME_RETRIES,
  shouldRetryRealtimeConnection,
  shouldStartRealtimeAfterLoadError
} from '../lib/realtimePolicy';

test('strict real mode skips websocket startup when runtime is not configured', () => {
  const error = new Error('[RUNTIME_NOT_CONFIGURED] OpenClaw runtime client is not configured.');

  assert.equal(shouldStartRealtimeAfterLoadError('real', error), false);
  assert.equal(shouldStartRealtimeAfterLoadError('local', error), true);
});

test('realtime retries are capped before the first successful connection', () => {
  assert.equal(shouldRetryRealtimeConnection(false, MAX_INITIAL_REALTIME_RETRIES - 1), true);
  assert.equal(shouldRetryRealtimeConnection(false, MAX_INITIAL_REALTIME_RETRIES), false);
  assert.equal(shouldRetryRealtimeConnection(true, MAX_INITIAL_REALTIME_RETRIES), true);
});
