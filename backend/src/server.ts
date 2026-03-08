import Fastify from 'fastify';
import cors from '@fastify/cors';
import { randomUUID } from 'node:crypto';
import { apiRoutes } from './routes/api';
import { registerRealtime } from './realtime/websocket';
import { runtimeBinding } from './runtime';
import { recordRequestMetric } from './observability';
import { auditTrail } from './audit/auditTrail';
import { store } from './store/mockStore';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';

async function buildServer() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    requestIdHeader: 'x-request-id',
    genReqId: (req) => {
      const incoming = req.headers['x-request-id'];
      return typeof incoming === 'string' && incoming.trim().length > 0 ? incoming : randomUUID();
    }
  });

  const corsOrigin = process.env.CORS_ORIGIN?.trim();

  await app.register(cors, {
    origin: corsOrigin && corsOrigin.length > 0 ? corsOrigin : true
  });

  app.addHook('onResponse', (req, reply, done) => {
    reply.header('x-request-id', req.id);

    const route = req.routeOptions.url ?? req.url;
    recordRequestMetric({
      method: req.method,
      route,
      statusCode: reply.statusCode,
      durationMs: reply.elapsedTime
    });

    done();
  });

  app.addHook('onClose', async () => {
    await Promise.all([store.flush(), auditTrail.flush()]);
  });

  await app.register(apiRoutes, { prefix: '/api' });
  await registerRealtime(app);

  app.log.info(
    {
      runtimeSource: runtimeBinding.mode,
      allowRuntimeFallback: runtimeBinding.allowFallback,
      runtimeDegraded: runtimeBinding.degraded
    },
    runtimeBinding.mode === 'openclaw'
      ? 'Runtime source selected: openclaw (adapter-ready boundary; live transport pending)'
      : 'Runtime source selected: mock'
  );

  if (runtimeBinding.warning) {
    app.log.warn({ runtimeWarning: runtimeBinding.warning }, runtimeBinding.warning);
  }

  if (process.env.NODE_ENV === 'production' && (!corsOrigin || corsOrigin.length === 0)) {
    app.log.warn('CORS_ORIGIN is not set in production; this defaults to permissive CORS. Set CORS_ORIGIN to a trusted origin.');
  }

  return app;
}

async function start() {
  const app = await buildServer();

  try {
    await app.listen({ port, host });
    app.log.info(`ClawVille backend listening at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void start();
