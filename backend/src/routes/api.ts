import { FastifyInstance, FastifyReply } from 'fastify';
import { runtimeSource } from '../runtime';
import { TaskStatus } from '../models/types';
import { RuntimeSourceUnavailableError } from '../runtime/openclawRuntimeSource';

function ok<T>(reply: FastifyReply, data: T, statusCode = 200) {
  return reply.code(statusCode).send({ success: true, data });
}

function fail(reply: FastifyReply, statusCode: number, message: string, code: string) {
  return reply.code(statusCode).send({ success: false, error: { code, message } });
}

function runtimeFailure(reply: FastifyReply, error: RuntimeSourceUnavailableError) {
  return fail(reply, 503, error.message, error.code);
}

function isRuntimeUnavailable(error: unknown): error is RuntimeSourceUnavailableError {
  return error instanceof RuntimeSourceUnavailableError;
}

export async function apiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_, reply) => ok(reply, { ok: true, ts: new Date().toISOString() }));

  app.get('/overview', async (_, reply) => {
    try {
      return ok(reply, runtimeSource.getOverview());
    } catch (error) {
      if (isRuntimeUnavailable(error)) return runtimeFailure(reply, error);
      throw error;
    }
  });

  app.get('/agents', async (_, reply) => {
    try {
      return ok(reply, runtimeSource.listAgents());
    } catch (error) {
      if (isRuntimeUnavailable(error)) return runtimeFailure(reply, error);
      throw error;
    }
  });

  app.post<{ Body: { name: string; role: string; status?: 'idle' | 'busy' | 'offline' } }>('/agents', async (req, reply) => {
    const { name, role, status } = req.body;
    if (!name || !role) {
      return fail(reply, 400, 'name and role are required', 'VALIDATION_ERROR');
    }

    try {
      const agent = runtimeSource.addAgent({ name, role, status });
      return ok(reply, agent, 201);
    } catch (error) {
      if (isRuntimeUnavailable(error)) return runtimeFailure(reply, error);
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>('/agents/:id/pause', async (req, reply) => {
    try {
      const agent = runtimeSource.pauseAgent(req.params.id);
      if (!agent) {
        return fail(reply, 404, 'Agent not found', 'NOT_FOUND');
      }

      return ok(reply, agent);
    } catch (error) {
      if (isRuntimeUnavailable(error)) return runtimeFailure(reply, error);
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>('/agents/:id/resume', async (req, reply) => {
    try {
      const agent = runtimeSource.resumeAgent(req.params.id);
      if (!agent) {
        return fail(reply, 404, 'Agent not found', 'NOT_FOUND');
      }

      return ok(reply, agent);
    } catch (error) {
      if (isRuntimeUnavailable(error)) return runtimeFailure(reply, error);
      throw error;
    }
  });

  app.get('/tasks', async (_, reply) => {
    try {
      return ok(reply, runtimeSource.listTasks());
    } catch (error) {
      if (isRuntimeUnavailable(error)) return runtimeFailure(reply, error);
      throw error;
    }
  });

  app.post<{
    Body: {
      title: string;
      description?: string;
      assigneeAgentId?: string;
      status?: TaskStatus;
      priority: 'low' | 'medium' | 'high';
    };
  }>('/tasks', async (req, reply) => {
    const { title, priority, description, assigneeAgentId, status } = req.body;
    if (!title || !priority) {
      return fail(reply, 400, 'title and priority are required', 'VALIDATION_ERROR');
    }

    try {
      const task = runtimeSource.addTask({ title, priority, description, assigneeAgentId, status });
      return ok(reply, task, 201);
    } catch (error) {
      if (isRuntimeUnavailable(error)) return runtimeFailure(reply, error);
      throw error;
    }
  });

  app.patch<{ Params: { id: string }; Body: { status: TaskStatus } }>('/tasks/:id/status', async (req, reply) => {
    try {
      const task = runtimeSource.updateTaskStatus(req.params.id, req.body.status);
      if (!task) {
        return fail(reply, 404, 'Task not found', 'NOT_FOUND');
      }
      return ok(reply, task);
    } catch (error) {
      if (isRuntimeUnavailable(error)) return runtimeFailure(reply, error);
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>('/tasks/:id/retry', async (req, reply) => {
    try {
      const task = runtimeSource.retryTask(req.params.id);
      if (!task) {
        return fail(reply, 404, 'Task not found', 'NOT_FOUND');
      }

      return ok(reply, task);
    } catch (error) {
      if (isRuntimeUnavailable(error)) return runtimeFailure(reply, error);
      throw error;
    }
  });

  app.get<{ Querystring: { limit?: number } }>('/events', async (req, reply) => {
    try {
      return ok(reply, runtimeSource.listEvents(req.query.limit));
    } catch (error) {
      if (isRuntimeUnavailable(error)) return runtimeFailure(reply, error);
      throw error;
    }
  });
}
