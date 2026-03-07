import { FastifyInstance } from 'fastify';
import websocketPlugin from '@fastify/websocket';
import { Event } from '../models/types';
import { runtimeSource } from '../runtime';
import { RuntimeSnapshot } from '../runtime/runtimeSource';

interface RealtimePayload {
  type: 'snapshot' | 'state_changed';
  data: {
    snapshot: RuntimeSnapshot;
    event?: Event;
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

    send({ type: 'snapshot', data: { snapshot: runtimeSource.getSnapshot() } });

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
