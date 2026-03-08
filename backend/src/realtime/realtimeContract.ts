import { Event } from '../models/types';
import { RuntimeSnapshot } from '../runtime/runtimeSource';

export interface RealtimePayload {
  type: 'snapshot' | 'state_changed';
  data: {
    snapshot: RuntimeSnapshot;
    event?: Event;
  };
}

export function createRealtimeSnapshotPayload(snapshot: RuntimeSnapshot): RealtimePayload {
  return {
    type: 'snapshot',
    data: { snapshot }
  };
}

export function createRealtimeStateChangedPayload(snapshot: RuntimeSnapshot, event?: Event): RealtimePayload {
  return {
    type: 'state_changed',
    data: event ? { snapshot, event } : { snapshot }
  };
}
