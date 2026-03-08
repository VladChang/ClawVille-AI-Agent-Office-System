import { FastifyReply, FastifyRequest } from 'fastify';

export type OperatorRole = 'viewer' | 'operator' | 'admin';

interface Actor {
  id: string;
  role: OperatorRole;
}

function fail(reply: FastifyReply, statusCode: number, message: string, code: string) {
  return reply.code(statusCode).send({ success: false, error: { code, message } });
}

function parseRole(value: string | undefined): OperatorRole | null {
  if (value === 'viewer' || value === 'operator' || value === 'admin') return value;
  return null;
}

function authMode(): 'off' | 'header' {
  return process.env.AUTH_MODE === 'header' ? 'header' : 'off';
}

export function getActor(req: FastifyRequest): Actor {
  const id = String(req.headers['x-operator-id'] ?? 'anonymous');
  const role = parseRole(typeof req.headers['x-operator-role'] === 'string' ? req.headers['x-operator-role'] : undefined) ?? 'admin';
  return { id, role };
}

export function requireMutationAccess(req: FastifyRequest, reply: FastifyReply): boolean {
  if (authMode() === 'off') return true;

  const operatorId = typeof req.headers['x-operator-id'] === 'string' ? req.headers['x-operator-id'].trim() : '';
  const role = parseRole(typeof req.headers['x-operator-role'] === 'string' ? req.headers['x-operator-role'] : undefined);

  if (!operatorId || !role) {
    fail(reply, 401, 'Missing or invalid operator credentials', 'UNAUTHORIZED');
    return false;
  }

  if (role === 'viewer') {
    fail(reply, 403, 'Role viewer is not allowed to perform mutation actions', 'FORBIDDEN');
    return false;
  }

  return true;
}
