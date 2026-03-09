import Fastify, { FastifyInstance, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import { OpenClawAdapterService, OpenClawAdapterUnavailableError, createOpenClawAdapterServiceFromEnv } from './service';

function ok<T>(reply: FastifyReply, data: T, statusCode = 200) {
  return reply.code(statusCode).send({ success: true, data });
}

function fail(reply: FastifyReply, statusCode: number, message: string, code: string) {
  return reply.code(statusCode).send({ success: false, error: { code, message } });
}

export async function buildOpenClawAdapterApp(service = createOpenClawAdapterServiceFromEnv()): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    requestIdHeader: 'x-request-id',
    genReqId: (req) => {
      const incoming = req.headers['x-request-id'];
      return typeof incoming === 'string' && incoming.trim().length > 0 ? incoming : randomUUID();
    }
  });

  app.get('/health', async (_, reply) => ok(reply, await service.health()));

  app.get('/snapshot', async (_, reply) => {
    try {
      return ok(reply, { snapshot: await service.getSnapshot() });
    } catch (error) {
      if (error instanceof OpenClawAdapterUnavailableError) {
        return fail(reply, error.statusCode, error.message, error.code);
      }
      throw error;
    }
  });

  app.get('/agents', async (_, reply) => {
    try {
      return ok(reply, await service.listAgents());
    } catch (error) {
      if (error instanceof OpenClawAdapterUnavailableError) {
        return fail(reply, error.statusCode, error.message, error.code);
      }
      throw error;
    }
  });

  app.patch<{ Params: { id: string }; Body: { displayName: string | null } }>(
    '/agents/:id/display-name',
    async (req, reply) => {
      try {
        const agent = await service.updateAgentDisplayName(req.params.id, req.body?.displayName ?? null);
        if (!agent) {
          return fail(reply, 404, 'Agent not found', 'NOT_FOUND');
        }
        return ok(reply, agent);
      } catch (error) {
        if (error instanceof OpenClawAdapterUnavailableError) {
          return fail(reply, error.statusCode, error.message, error.code);
        }
        throw error;
      }
    }
  );

  app.post<{ Params: { id: string } }>('/agents/:id/pause', async (req, reply) => {
    try {
      const agent = await service.pauseAgent(req.params.id);
      if (!agent) {
        return fail(reply, 404, 'Agent not found', 'NOT_FOUND');
      }
      return ok(reply, agent);
    } catch (error) {
      if (error instanceof OpenClawAdapterUnavailableError) {
        return fail(reply, error.statusCode, error.message, error.code);
      }
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>('/agents/:id/resume', async (req, reply) => {
    try {
      const agent = await service.resumeAgent(req.params.id);
      if (!agent) {
        return fail(reply, 404, 'Agent not found', 'NOT_FOUND');
      }
      return ok(reply, agent);
    } catch (error) {
      if (error instanceof OpenClawAdapterUnavailableError) {
        return fail(reply, error.statusCode, error.message, error.code);
      }
      throw error;
    }
  });

  app.get('/tasks', async (_, reply) => {
    try {
      return ok(reply, await service.listTasks());
    } catch (error) {
      if (error instanceof OpenClawAdapterUnavailableError) {
        return fail(reply, error.statusCode, error.message, error.code);
      }
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>('/tasks/:id/retry', async (req, reply) => {
    try {
      const task = await service.retryTask(req.params.id);
      if (!task) {
        return fail(reply, 404, 'Task not found', 'NOT_FOUND');
      }
      return ok(reply, task);
    } catch (error) {
      if (error instanceof OpenClawAdapterUnavailableError) {
        return fail(reply, error.statusCode, error.message, error.code);
      }
      throw error;
    }
  });

  app.get<{ Querystring: { limit?: number } }>('/events', async (req, reply) => {
    try {
      return ok(reply, await service.listEvents(req.query.limit));
    } catch (error) {
      if (error instanceof OpenClawAdapterUnavailableError) {
        return fail(reply, error.statusCode, error.message, error.code);
      }
      throw error;
    }
  });

  return app;
}
