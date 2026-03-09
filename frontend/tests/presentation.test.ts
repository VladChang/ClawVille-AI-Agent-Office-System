import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRuntimeSourceDetail,
  getRuntimeSourceTone,
  getRuntimeVerificationLabel
} from '../lib/presentation';
import type { RuntimeStatusSnapshot } from '../types/models';

function runtimeStatus(overrides: Partial<RuntimeStatusSnapshot>): RuntimeStatusSnapshot {
  return {
    mode: 'openclaw',
    allowFallback: false,
    degraded: true,
    verified: false,
    dataSource: 'openclaw_adapter_only',
    ...overrides
  };
}

test('presentation labels verified openclaw upstream as production-ready source', () => {
  const status = runtimeStatus({
    degraded: false,
    verified: true,
    dataSource: 'openclaw_upstream'
  });

  assert.equal(getRuntimeSourceTone(status), 'verified');
  assert.equal(getRuntimeVerificationLabel(status), '已驗證真實 OpenClaw 上游');
  assert.equal(getRuntimeSourceDetail(status), '已驗證真實 OpenClaw 上游');
});

test('presentation exposes upstream warning before generic adapter detail', () => {
  const status = runtimeStatus({
    warning: 'OpenClaw adapter 可連線，但上游 runtime 目前不健康。'
  });

  assert.equal(getRuntimeSourceTone(status), 'caution');
  assert.equal(getRuntimeVerificationLabel(status), 'Adapter 可達，但真實上游未驗證');
  assert.equal(getRuntimeSourceDetail(status), 'OpenClaw adapter 可連線，但上游 runtime 目前不健康。');
});

test('presentation marks strict unconfigured runtime as danger', () => {
  const status = runtimeStatus({
    dataSource: 'openclaw_strict_unconfigured',
    warning: 'OpenClaw adapter endpoint 尚未設定。'
  });

  assert.equal(getRuntimeSourceTone(status), 'danger');
  assert.equal(getRuntimeVerificationLabel(status), '尚未完成 OpenClaw 設定');
  assert.equal(getRuntimeSourceDetail(status), 'OpenClaw adapter endpoint 尚未設定。');
});
