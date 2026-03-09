import { RuntimeSource } from './runtimeSource';
import { mockRuntimeSource } from './mockRuntimeSource';
import {
  OpenClawRuntimeSource,
  OpenClawStubRuntimeClient,
  OpenClawTransportRuntimeClient,
  RuntimeNotConfiguredReason
} from './openclawRuntimeSource';
import { createOpenClawTransportFromEnv } from './openclawTransport';

export type RuntimeSourceMode = 'mock' | 'openclaw';

function isRuntimeSourceMode(value: string | undefined): value is RuntimeSourceMode {
  return value === 'mock' || value === 'openclaw';
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

function hasFixtureTransportEnv(): boolean {
  return Boolean(process.env.OPENCLAW_RUNTIME_FIXTURE_JSON || process.env.OPENCLAW_RUNTIME_FIXTURE_PATH);
}

function readRuntimeAdapterEndpoint(): string | undefined {
  return process.env.OPENCLAW_ADAPTER_ENDPOINT?.trim() || process.env.OPENCLAW_RUNTIME_ENDPOINT?.trim();
}

function hasRuntimeAdapterEndpoint(endpoint: string | undefined): boolean {
  return Boolean(endpoint);
}

function resolveStubReason(endpoint: string | undefined): RuntimeNotConfiguredReason {
  if (!endpoint) return 'missing-endpoint';
  return 'client-unavailable';
}

export function resolveRuntimeSourceMode(envValue: string | undefined): RuntimeSourceMode {
  if (isRuntimeSourceMode(envValue)) {
    return envValue;
  }

  return 'mock';
}

export interface RuntimeBinding {
  mode: RuntimeSourceMode;
  allowFallback: boolean;
  degraded: boolean;
  warning?: string;
}

export function createRuntimeSourceForMode(mode: RuntimeSourceMode): RuntimeSource {
  if (mode === 'openclaw') {
    const allowFallback = parseBooleanEnv(process.env.ALLOW_RUNTIME_FALLBACK);
    const endpoint = readRuntimeAdapterEndpoint();
    const transport = createOpenClawTransportFromEnv();

    return new OpenClawRuntimeSource({
      client: transport ? new OpenClawTransportRuntimeClient(transport) : new OpenClawStubRuntimeClient(resolveStubReason(endpoint)),
      fallback: mockRuntimeSource,
      allowFallback
    });
  }

  return mockRuntimeSource;
}

const runtimeSourceMode = resolveRuntimeSourceMode(process.env.RUNTIME_SOURCE);
const allowRuntimeFallback = parseBooleanEnv(process.env.ALLOW_RUNTIME_FALLBACK);
const endpoint = readRuntimeAdapterEndpoint();
const runtimeClientConfigured = hasFixtureTransportEnv() || hasRuntimeAdapterEndpoint(endpoint);

// Central runtime source binding point.
// Future OpenClaw adapters should be wired here without changing API/WS route contracts.
export const runtimeSource: RuntimeSource = createRuntimeSourceForMode(runtimeSourceMode);

const runtimeDegraded = runtimeSourceMode === 'openclaw' && !runtimeClientConfigured;

const runtimeWarning =
  runtimeSourceMode === 'openclaw' && runtimeDegraded && !allowRuntimeFallback
    ? 'OpenClaw adapter endpoint is not configured. Backend runs in strict degraded mode (no mock fallback). Set OPENCLAW_ADAPTER_ENDPOINT (or legacy OPENCLAW_RUNTIME_ENDPOINT), or OPENCLAW_RUNTIME_FIXTURE_PATH/OPENCLAW_RUNTIME_FIXTURE_JSON, or ALLOW_RUNTIME_FALLBACK=true.'
    : runtimeSourceMode === 'openclaw' && runtimeDegraded && allowRuntimeFallback
      ? 'OpenClaw adapter endpoint is not configured. ALLOW_RUNTIME_FALLBACK=true enables mock fallback for non-production use.'
      : undefined;

export const runtimeBinding: RuntimeBinding = {
  mode: runtimeSourceMode,
  allowFallback: allowRuntimeFallback,
  degraded: runtimeDegraded,
  warning: runtimeWarning
};
