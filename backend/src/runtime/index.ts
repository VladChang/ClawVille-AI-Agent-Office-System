import { RuntimeSource } from './runtimeSource';
import { mockRuntimeSource } from './mockRuntimeSource';
import { OpenClawRuntimeSource } from './openclawRuntimeSource';

export type RuntimeSourceMode = 'mock' | 'openclaw';

function isRuntimeSourceMode(value: string | undefined): value is RuntimeSourceMode {
  return value === 'mock' || value === 'openclaw';
}

export function resolveRuntimeSourceMode(envValue: string | undefined): RuntimeSourceMode {
  if (isRuntimeSourceMode(envValue)) {
    return envValue;
  }

  return 'mock';
}

export function createRuntimeSourceForMode(mode: RuntimeSourceMode): RuntimeSource {
  if (mode === 'openclaw') {
    return new OpenClawRuntimeSource(mockRuntimeSource);
  }

  return mockRuntimeSource;
}

const runtimeSourceMode = resolveRuntimeSourceMode(process.env.RUNTIME_SOURCE);

// Central runtime source binding point.
// Future OpenClaw adapters should be wired here without changing API/WS route contracts.
export const runtimeSource: RuntimeSource = createRuntimeSourceForMode(runtimeSourceMode);

export const runtimeBinding = {
  mode: runtimeSourceMode,
  isFallback: runtimeSourceMode === 'openclaw'
} as const;
