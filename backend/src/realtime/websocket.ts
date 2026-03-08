import { FastifyInstance } from 'fastify';
import websocketPlugin from '@fastify/websocket';
import { runtimeBinding, runtimeSource } from '../runtime';
import { RuntimeSnapshot } from '../runtime/runtimeSource';
import { RuntimeSourceUnavailableError } from '../runtime/openclawRuntimeSource';
import { createRealtimeSnapshotPayload, createRealtimeStateChangedPayload, RealtimePayload } from './realtimeContract';

interface RealtimeWebSocketLike {
  readyState: number;
  send(payload: string): void;
  on(event: 'close', listener: () => void): void;
}

type RealtimeConnectionLike = RealtimeWebSocketLike | { socket: RealtimeWebSocketLike };

function emptySnapshot(message: string): RuntimeSnapshot {
  const now = new Date().toISOString();
  return {
    overview: {
      generatedAt: now,
      counts: { agents: 0, tasks: 0, events: 1, activeAgents: 0, openTasks: 0 },
      agentsByStatus: { idle: 0, busy: 0, offline: 0 },
      tasksByStatus: { todo: 0, in_progress: 0, blocked: 0, done: 0 }
    },
    agents: [],
    tasks: [],
    events: [
      {
        id: `runtime-${Date.now()}`,
        type: 'system',
        level: 'warning',
        timestamp: now,
        message
      }
    ]
  };
}

let simulationInterval: ReturnType<typeof setInterval> | null = null;

function shouldRunSimulationLoop(): boolean {
  return runtimeBinding.mode === 'mock' || runtimeBinding.allowFallback;
}

function ensureSimulationLoop(): void {
  if (!shouldRunSimulationLoop() || simulationInterval) return;

  simulationInterval = setInterval(() => {
    runtimeSource.updateRandomState();
  }, 5000);

  simulationInterval.unref?.();
}

function stopSimulationLoop(): void {
  if (!simulationInterval) return;
  clearInterval(simulationInterval);
  simulationInterval = null;
}

export function resolveRealtimeSocket(connection: RealtimeConnectionLike): RealtimeWebSocketLike {
  return 'socket' in connection ? connection.socket : connection;
}

export async function registerRealtime(app: FastifyInstance): Promise<void> {
  await app.register(websocketPlugin);
  ensureSimulationLoop();

  app.addHook('onClose', (_instance, done) => {
    stopSimulationLoop();
    done();
  });

  app.get('/ws', { websocket: true }, (connection) => {
    const socket = resolveRealtimeSocket(connection as RealtimeConnectionLike);

    const send = (message: RealtimePayload) => {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify(message));
      }
    };

    void (async () => {
      try {
        send(createRealtimeSnapshotPayload(await runtimeSource.getSnapshot()));
      } catch (error) {
        if (error instanceof RuntimeSourceUnavailableError) {
          send(createRealtimeSnapshotPayload(emptySnapshot(error.message)));
          return;
        }

        const message = error instanceof Error ? error.message : 'Unknown realtime initialization error.';
        app.log.error({ err: error }, 'Failed to initialize realtime websocket snapshot');
        send(createRealtimeSnapshotPayload(emptySnapshot(message)));
      }
    })();

    const unsubscribe = runtimeSource.onStateChange(({ snapshot, event }) => {
      send(createRealtimeStateChangedPayload(snapshot, event));
    });

    socket.on('close', () => {
      unsubscribe();
    });
  });
}
