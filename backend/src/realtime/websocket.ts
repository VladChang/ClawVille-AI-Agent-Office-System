import { FastifyInstance } from 'fastify';
import websocketPlugin from '@fastify/websocket';
import { Event } from '../models/types';
import { runtimeSource } from '../runtime';
import { RuntimeSnapshot } from '../runtime/runtimeSource';
import { RuntimeSourceUnavailableError } from '../runtime/openclawRuntimeSource';

interface RealtimePayload {
  type: 'snapshot' | 'state_changed';
  data: {
    snapshot: RuntimeSnapshot;
    event?: Event;
  };
}

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
        timestamp: now,
        message
      }
    ]
  };
}

export async function registerRealtime(app: FastifyInstance): Promise<void> {
  await app.register(websocketPlugin);

  app.get('/ws', { websocket: true }, (connection) => {
    const send = (message: RealtimePayload) => {
      if (connection.socket.readyState === connection.socket.OPEN) {
        connection.socket.send(JSON.stringify(message));
      }
    };

    try {
      send({ type: 'snapshot', data: { snapshot: runtimeSource.getSnapshot() } });
    } catch (error) {
      if (error instanceof RuntimeSourceUnavailableError) {
        send({
          type: 'snapshot',
          data: { snapshot: emptySnapshot(error.message) }
        });
      } else {
        throw error;
      }
    }

    const unsubscribe = runtimeSource.onStateChange(({ snapshot, event }) => {
      send({ type: 'state_changed', data: { snapshot, event } });
    });

    const interval = setInterval(() => {
      runtimeSource.updateRandomState();
    }, 5000);

    connection.socket.on('close', () => {
      unsubscribe();
      clearInterval(interval);
    });
  });
}
