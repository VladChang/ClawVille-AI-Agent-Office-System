import { FastifyInstance, FastifyReply } from 'fastify';
import { runtimeBinding, runtimeSource } from '../runtime';
import { AGENT_STATUSES, AgentStatus, TASK_PRIORITIES, TASK_STATUSES, TaskStatus } from '../models/types';
import { RuntimeSourceUnavailableError } from '../runtime/openclawRuntimeSource';
import { renderPrometheusMetrics } from '../observability';
import { auditTrail } from '../audit/auditTrail';
import { getActor, requireMutationAccess } from '../security/authz';

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

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1 }
  }
} as const;

const createAgentBodySchema = {
  type: 'object',
  required: ['name', 'role'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1 },
    role: { type: 'string', minLength: 1 },
    status: { type: 'string', enum: [...AGENT_STATUSES] }
  }
} as const;

const createTaskBodySchema = {
  type: 'object',
  required: ['title', 'priority'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    assigneeAgentId: { type: 'string', minLength: 1 },
    status: { type: 'string', enum: [...TASK_STATUSES] },
    priority: { type: 'string', enum: [...TASK_PRIORITIES] }
  }
} as const;

const updateTaskStatusBodySchema = {
  type: 'object',
  required: ['status'],
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: [...TASK_STATUSES] }
  }
} as const;

const eventsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 1000 }
  }
} as const;

const auditQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 500 }
  }
} as const;

export async function apiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_, reply) => ok(reply, { ok: true, ts: new Date().toISOString() }));

  app.get('/ready', async (_, reply) => {
    if (runtimeBinding.mode === 'openclaw' && runtimeBinding.degraded && !runtimeBinding.allowFallback) {
      return fail(
        reply,
        503,
        'Runtime source is configured as openclaw but adapter is not fully configured. Backend is in strict degraded mode.',
        'NOT_READY'
      );
    }

    return ok(reply, {
      ok: true,
      runtimeSource: runtimeBinding.mode,
      runtimeDegraded: runtimeBinding.degraded,
      allowRuntimeFallback: runtimeBinding.allowFallback,
      ts: new Date().toISOString()
    });
  });

  app.get('/metrics', async (_, reply) => {
    return reply
      .code(200)
      .type('text/plain; version=0.0.4; charset=utf-8')
      .send(renderPrometheusMetrics());
  });

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

  app.post<{ Body: { name: string; role: string; status?: AgentStatus } }>(
    '/agents',
    {
      schema: { body: createAgentBodySchema },
      preHandler: (req, reply) => {
        if (!requireMutationAccess(req, reply)) return;
      }
    },
    async (req, reply) => {
    const actor = getActor(req);
    const { name, role, status } = req.body;
    if (!name || !role) {
      auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'agent.create', targetType: 'agent', result: 'failure', reason: 'VALIDATION_ERROR' });
      return fail(reply, 400, 'name and role are required', 'VALIDATION_ERROR');
    }

    try {
      const agent = runtimeSource.addAgent({ name, role, status });
      auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'agent.create', targetType: 'agent', targetId: agent.id, result: 'success' });
      return ok(reply, agent, 201);
    } catch (error) {
      if (isRuntimeUnavailable(error)) {
        auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'agent.create', targetType: 'agent', result: 'failure', reason: error.code });
        return runtimeFailure(reply, error);
      }
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>(
    '/agents/:id/pause',
    {
      schema: { params: idParamsSchema },
      preHandler: (req, reply) => {
        if (!requireMutationAccess(req, reply)) return;
      }
    },
    async (req, reply) => {
    const actor = getActor(req);
    try {
      const agent = runtimeSource.pauseAgent(req.params.id);
      if (!agent) {
        auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'agent.pause', targetType: 'agent', targetId: req.params.id, result: 'failure', reason: 'NOT_FOUND' });
        return fail(reply, 404, 'Agent not found', 'NOT_FOUND');
      }

      auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'agent.pause', targetType: 'agent', targetId: agent.id, result: 'success' });
      return ok(reply, agent);
    } catch (error) {
      if (isRuntimeUnavailable(error)) {
        auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'agent.pause', targetType: 'agent', targetId: req.params.id, result: 'failure', reason: error.code });
        return runtimeFailure(reply, error);
      }
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>(
    '/agents/:id/resume',
    {
      schema: { params: idParamsSchema },
      preHandler: (req, reply) => {
        if (!requireMutationAccess(req, reply)) return;
      }
    },
    async (req, reply) => {
    const actor = getActor(req);
    try {
      const agent = runtimeSource.resumeAgent(req.params.id);
      if (!agent) {
        auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'agent.resume', targetType: 'agent', targetId: req.params.id, result: 'failure', reason: 'NOT_FOUND' });
        return fail(reply, 404, 'Agent not found', 'NOT_FOUND');
      }

      auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'agent.resume', targetType: 'agent', targetId: agent.id, result: 'success' });
      return ok(reply, agent);
    } catch (error) {
      if (isRuntimeUnavailable(error)) {
        auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'agent.resume', targetType: 'agent', targetId: req.params.id, result: 'failure', reason: error.code });
        return runtimeFailure(reply, error);
      }
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
  }>(
    '/tasks',
    {
      schema: { body: createTaskBodySchema },
      preHandler: (req, reply) => {
        if (!requireMutationAccess(req, reply)) return;
      }
    },
    async (req, reply) => {
    const actor = getActor(req);
    const { title, priority, description, assigneeAgentId, status } = req.body;
    if (!title || !priority) {
      auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'task.create', targetType: 'task', result: 'failure', reason: 'VALIDATION_ERROR' });
      return fail(reply, 400, 'title and priority are required', 'VALIDATION_ERROR');
    }

    try {
      const task = runtimeSource.addTask({ title, priority, description, assigneeAgentId, status });
      auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'task.create', targetType: 'task', targetId: task.id, result: 'success' });
      return ok(reply, task, 201);
    } catch (error) {
      if (isRuntimeUnavailable(error)) {
        auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'task.create', targetType: 'task', result: 'failure', reason: error.code });
        return runtimeFailure(reply, error);
      }
      throw error;
    }
  });

  app.patch<{ Params: { id: string }; Body: { status: TaskStatus } }>(
    '/tasks/:id/status',
    {
      schema: { params: idParamsSchema, body: updateTaskStatusBodySchema },
      preHandler: (req, reply) => {
        if (!requireMutationAccess(req, reply)) return;
      }
    },
    async (req, reply) => {
    const actor = getActor(req);
    try {
      const task = runtimeSource.updateTaskStatus(req.params.id, req.body.status);
      if (!task) {
        auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'task.update_status', targetType: 'task', targetId: req.params.id, result: 'failure', reason: 'NOT_FOUND' });
        return fail(reply, 404, 'Task not found', 'NOT_FOUND');
      }
      auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'task.update_status', targetType: 'task', targetId: task.id, result: 'success' });
      return ok(reply, task);
    } catch (error) {
      if (isRuntimeUnavailable(error)) {
        auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'task.update_status', targetType: 'task', targetId: req.params.id, result: 'failure', reason: error.code });
        return runtimeFailure(reply, error);
      }
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>(
    '/tasks/:id/retry',
    {
      schema: { params: idParamsSchema },
      preHandler: (req, reply) => {
        if (!requireMutationAccess(req, reply)) return;
      }
    },
    async (req, reply) => {
    const actor = getActor(req);
    try {
      const task = runtimeSource.retryTask(req.params.id);
      if (!task) {
        auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'task.retry', targetType: 'task', targetId: req.params.id, result: 'failure', reason: 'NOT_FOUND' });
        return fail(reply, 404, 'Task not found', 'NOT_FOUND');
      }

      auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'task.retry', targetType: 'task', targetId: task.id, result: 'success' });
      return ok(reply, task);
    } catch (error) {
      if (isRuntimeUnavailable(error)) {
        auditTrail.record({ actorId: actor.id, actorRole: actor.role, action: 'task.retry', targetType: 'task', targetId: req.params.id, result: 'failure', reason: error.code });
        return runtimeFailure(reply, error);
      }
      throw error;
    }
  });

  app.get<{ Querystring: { limit?: number } }>(
    '/events',
    { schema: { querystring: eventsQuerySchema } },
    async (req, reply) => {
    try {
      return ok(reply, runtimeSource.listEvents(req.query.limit));
    } catch (error) {
      if (isRuntimeUnavailable(error)) return runtimeFailure(reply, error);
      throw error;
    }
  });

  app.get<{ Querystring: { limit?: number } }>(
    '/audit',
    { schema: { querystring: auditQuerySchema } },
    async (req, reply) => ok(reply, auditTrail.list(req.query.limit ?? 50))
  );
}
