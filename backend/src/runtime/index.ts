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

export type RuntimeDataSource =
  | 'mock'
  | 'openclaw_fixture'
  | 'openclaw_upstream'
  | 'openclaw_adapter_only'
  | 'openclaw_mock_fallback'
  | 'openclaw_strict_unconfigured';

export interface RuntimeStatus {
  mode: RuntimeSourceMode;
  allowFallback: boolean;
  degraded: boolean;
  verified: boolean;
  dataSource: RuntimeDataSource;
  warning?: string;
  counts?: {
    agents: number;
    tasks: number;
    events: number;
  };
  adapter?: {
    endpoint?: string;
    endpointConfigured: boolean;
    reachable: boolean;
    configured: boolean;
    upstreamHealthy: boolean;
  };
}

async function fetchAdapterHealth(endpoint: string | undefined): Promise<RuntimeStatus['adapter']> {
  if (!endpoint) {
    return {
      endpointConfigured: false,
      reachable: false,
      configured: false,
      upstreamHealthy: false
    };
  }

  try {
    const healthUrl = new URL('health', endpoint.endsWith('/') ? endpoint : `${endpoint}/`);
    const response = await fetch(healthUrl);
    if (!response.ok) {
      return {
        endpoint,
        endpointConfigured: true,
        reachable: false,
        configured: false,
        upstreamHealthy: false
      };
    }

    const payload = (await response.json()) as {
      success?: boolean;
      data?: { configured?: boolean; upstreamHealthy?: boolean };
    };

    return {
      endpoint,
      endpointConfigured: true,
      reachable: true,
      configured: payload?.success === true && payload.data?.configured === true,
      upstreamHealthy: payload?.success === true && payload.data?.upstreamHealthy === true
    };
  } catch {
    return {
      endpoint,
      endpointConfigured: true,
      reachable: false,
      configured: false,
      upstreamHealthy: false
    };
  }
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

export async function getRuntimeStatus(): Promise<RuntimeStatus> {
  const fixtureEnabled = hasFixtureTransportEnv();
  const adapter = runtimeSourceMode === 'openclaw' && !fixtureEnabled ? await fetchAdapterHealth(endpoint) : undefined;
  const verified =
    runtimeSourceMode === 'openclaw' &&
    !fixtureEnabled &&
    !runtimeDegraded &&
    adapter?.endpointConfigured === true &&
    adapter.reachable === true &&
    adapter.configured === true &&
    adapter.upstreamHealthy === true;

  let counts: RuntimeStatus['counts'];
  try {
    const snapshot = await runtimeSource.getSnapshot();
    counts = {
      agents: snapshot.agents.length,
      tasks: snapshot.tasks.length,
      events: snapshot.events.length
    };
  } catch {
    counts = undefined;
  }

  let dataSource: RuntimeDataSource = 'mock';
  if (runtimeSourceMode === 'openclaw') {
    if (fixtureEnabled) {
      dataSource = 'openclaw_fixture';
    } else if (verified) {
      dataSource = 'openclaw_upstream';
    } else if (runtimeDegraded && allowRuntimeFallback) {
      dataSource = 'openclaw_mock_fallback';
    } else if (adapter?.endpointConfigured) {
      dataSource = 'openclaw_adapter_only';
    } else {
      dataSource = 'openclaw_strict_unconfigured';
    }
  }

  return {
    mode: runtimeBinding.mode,
    allowFallback: runtimeBinding.allowFallback,
    degraded: runtimeBinding.degraded,
    verified,
    dataSource,
    warning: runtimeBinding.warning,
    counts,
    adapter
  };
}
