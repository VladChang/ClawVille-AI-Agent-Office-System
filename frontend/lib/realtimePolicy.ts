import type { RuntimeMode } from '@/lib/runtime';
import { isRuntimeNotConfiguredError } from '@/lib/runtimeAdapter';

export const MAX_INITIAL_REALTIME_RETRIES = 5;

export function shouldStartRealtimeAfterLoadError(mode: RuntimeMode, error: unknown): boolean {
  if (mode === 'real' && isRuntimeNotConfiguredError(error)) {
    return false;
  }

  return true;
}

export function shouldRetryRealtimeConnection(hasConnectedOnce: boolean, reconnectAttempt: number): boolean {
  return hasConnectedOnce || reconnectAttempt < MAX_INITIAL_REALTIME_RETRIES;
}
