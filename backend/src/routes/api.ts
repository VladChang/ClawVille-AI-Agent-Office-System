import { FastifyInstance, FastifyReply } from 'fastify';
import { store } from '../store/mockStore';
import { TaskStatus } from '../models/types';

function ok<T>(reply: FastifyReply, data: T, statusCode = 200) {
  return reply.code(statusCode).send({ success: true, data });
}

function fail(reply: FastifyReply, statusCode: number, message: string, code: string) {
  return reply.code(statusCode).send({ success: false, error: { code, message } });
}

export async function apiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_, reply) => ok(reply, { ok: true, ts: new Date().toISOString() }));

  app.get('/overview', async (_, reply) => ok(reply, store.getOverview()));

  app.get('/agents', async (_, reply) => ok(reply, store.listAgents()));

  app.post<{ Body: { name: string; role: string; status?: 'idle' | 'busy' | 'offline' } }>('/agents', async (req, reply) => {
    const { name, role, status } = req.body;
    if (!name || !role) {
      return fail(reply, 400, 'name and role are required', 'VALIDATION_ERROR');
    }

    const agent = store.addAgent({ name, role, status });
    return ok(reply, agent, 201);
  });

  app.post<{ Params: { id: string } }>('/agents/:id/pause', async (req, reply) => {
    const agent = store.pauseAgent(req.params.id);
    if (!agent) {
      return fail(reply, 404, 'Agent not found', 'NOT_FOUND');
    }

    return ok(reply, agent);
  });

  app.post<{ Params: { id: string } }>('/agents/:id/resume', async (req, reply) => {
    const agent = store.resumeAgent(req.params.id);
    if (!agent) {
      return fail(reply, 404, 'Agent not found', 'NOT_FOUND');
    }

    return ok(reply, agent);
  });

  app.get('/tasks', async (_, reply) => ok(reply, store.listTasks()));

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

    const task = store.addTask({ title, priority, description, assigneeAgentId, status });
    return ok(reply, task, 201);
  });

  app.patch<{ Params: { id: string }; Body: { status: TaskStatus } }>('/tasks/:id/status', async (req, reply) => {
    const task = store.updateTaskStatus(req.params.id, req.body.status);
    if (!task) {
      return fail(reply, 404, 'Task not found', 'NOT_FOUND');
    }
    return ok(reply, task);
  });

  app.post<{ Params: { id: string } }>('/tasks/:id/retry', async (req, reply) => {
    const task = store.retryTask(req.params.id);
    if (!task) {
      return fail(reply, 404, 'Task not found', 'NOT_FOUND');
    }

    return ok(reply, task);
  });

  app.get<{ Querystring: { limit?: number } }>('/events', async (req, reply) => ok(reply, store.listEvents(req.query.limit)));
}
