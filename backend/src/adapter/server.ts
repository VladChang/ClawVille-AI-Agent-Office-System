import { buildOpenClawAdapterApp } from './app';

const port = Number(process.env.PORT ?? 3010);
const host = process.env.HOST ?? '0.0.0.0';

async function start() {
  const app = await buildOpenClawAdapterApp();

  try {
    await app.listen({ port, host });
    app.log.info(`OpenClaw adapter listening at http://${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
