import Fastify from 'fastify';
import cors from '@fastify/cors';
import { apiRoutes } from './routes/api';
import { registerRealtime } from './realtime/websocket';
import { runtimeBinding } from './runtime';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';

async function buildServer() {
  const app = Fastify({ logger: true });

  const corsOrigin = process.env.CORS_ORIGIN?.trim();

  await app.register(cors, {
    origin: corsOrigin && corsOrigin.length > 0 ? corsOrigin : true
  });

  await app.register(apiRoutes, { prefix: '/api' });
  await registerRealtime(app);

  app.log.info(
    {
      runtimeSource: runtimeBinding.mode,
      round1PlaceholderFallback: runtimeBinding.isFallback
    },
    runtimeBinding.mode === 'openclaw'
      ? 'Runtime source selected: openclaw (Round 1 placeholder with mock fallback)'
      : 'Runtime source selected: mock'
  );

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
