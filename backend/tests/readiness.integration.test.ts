import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to allocate free port'));
        return;
      }

      const port = address.port;
      server.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
    server.on('error', reject);
  });
}

function isListenPermissionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'EPERM'
  );
}

function skipIfPortBindingUnavailable(t: TestContext, error: unknown): never {
  if (isListenPermissionError(error)) {
    t.skip('Local port binding is not permitted in this execution environment.');
  }

  throw error;
}

async function waitForHealth(url: string, retries = 50, delayMs = 200): Promise<void> {
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }

  throw new Error(`Server did not become healthy at ${url}`);
}

async function waitForCondition(assertion: () => Promise<boolean>, retries = 40, delayMs = 150): Promise<void> {
  for (let i = 0; i < retries; i += 1) {
    if (await assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error('Condition was not met within the expected time window');
}

test('GET /api/ready returns 503 NOT_READY in strict openclaw mode when runtime is not configured', async (t) => {
  let port: number;
  try {
    port = await getFreePort();
  } catch (error) {
    skipIfPortBindingUnavailable(t, error);
  }

  const child = spawn(
    process.execPath,
    ['./node_modules/tsx/dist/cli.mjs', 'src/server.ts'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        HOST: '127.0.0.1',
        LOG_LEVEL: 'error',
        RUNTIME_SOURCE: 'openclaw',
        ALLOW_RUNTIME_FALLBACK: 'false',
        OPENCLAW_RUNTIME_ENDPOINT: '',
        OPENCLAW_RUNTIME_API_KEY: ''
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  let stderr = '';
  child.stderr?.on('data', (chunk) => {
    stderr += String(chunk);
  });

  try {
    await waitForHealth(`http://127.0.0.1:${port}/api/health`);

    const readyRes = await fetch(`http://127.0.0.1:${port}/api/ready`);
    assert.equal(readyRes.status, 503);

    const readyBody = await readyRes.json();
    assert.equal(readyBody.success, false);
    assert.equal(readyBody.error.code, 'NOT_READY');

    const healthRes = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthBody = await healthRes.json();
    assert.equal(healthBody.success, true);
    assert.equal(healthBody.data.ok, true);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
  }

  assert.equal(stderr.includes('EADDRINUSE'), false, 'unexpected port collision during readiness integration test');
});

test('GET /api/ready and /api/runtime/status reflect openclaw upstream outage and recovery', async (t) => {
  let backendPort: number;
  let adapterPort: number;

  try {
    backendPort = await getFreePort();
    adapterPort = await getFreePort();
  } catch (error) {
    skipIfPortBindingUnavailable(t, error);
  }
  const adapterState = {
    configured: true,
    upstreamHealthy: false
  };

  const adapterServer = createHttpServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${adapterPort}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          data: {
            configured: adapterState.configured,
            upstreamHealthy: adapterState.upstreamHealthy
          }
        })
      );
      return;
    }

    if (req.method === 'GET' && url.pathname === '/snapshot') {
      if (!adapterState.upstreamHealthy) {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'OpenClaw upstream is unhealthy' } }));
        return;
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          data: {
            snapshot: {
              agents: [
                {
                  id: 'upstream-agent-1',
                  name: 'Atlas',
                  role: 'Coordinator',
                  status: 'busy',
                  updatedAt: '2026-03-09T00:00:00.000Z'
                }
              ],
              tasks: [
                {
                  id: 'upstream-task-1',
                  title: 'Recover runtime',
                  status: 'in_progress',
                  priority: 'high',
                  assigneeAgentId: 'upstream-agent-1',
                  createdAt: '2026-03-09T00:00:00.000Z',
                  updatedAt: '2026-03-09T00:00:00.000Z'
                }
              ],
              events: [
                {
                  id: 'upstream-event-1',
                  type: 'task_updated',
                  message: 'Upstream recovered',
                  timestamp: '2026-03-09T00:00:00.000Z',
                  metadata: { taskId: 'upstream-task-1', status: 'in_progress' }
                }
              ]
            }
          }
        })
      );
      return;
    }

    if (req.method === 'GET' && url.pathname === '/agents') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: [] }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/tasks') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: [] }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: [] }));
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: `Unhandled route ${req.method} ${url.pathname}` } }));
  });

  try {
    await new Promise<void>((resolve, reject) => {
      adapterServer.listen(adapterPort, '127.0.0.1', () => resolve());
      adapterServer.once('error', reject);
    });
  } catch (error) {
    await new Promise<void>((resolve) => adapterServer.close(() => resolve()));
    skipIfPortBindingUnavailable(t, error);
  }

  const child = spawn(
    process.execPath,
    ['./node_modules/tsx/dist/cli.mjs', 'src/server.ts'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(backendPort),
        HOST: '127.0.0.1',
        LOG_LEVEL: 'error',
        RUNTIME_SOURCE: 'openclaw',
        ALLOW_RUNTIME_FALLBACK: 'false',
        OPENCLAW_ADAPTER_ENDPOINT: `http://127.0.0.1:${adapterPort}`
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  let stderr = '';
  child.stderr?.on('data', (chunk) => {
    stderr += String(chunk);
  });

  try {
    await waitForHealth(`http://127.0.0.1:${backendPort}/api/health`);

    const degradedStatusRes = await fetch(`http://127.0.0.1:${backendPort}/api/runtime/status`);
    assert.equal(degradedStatusRes.status, 200);
    const degradedStatus = await degradedStatusRes.json();
    assert.equal(degradedStatus.success, true);
    assert.equal(degradedStatus.data.verified, false);
    assert.equal(degradedStatus.data.degraded, true);
    assert.equal(degradedStatus.data.dataSource, 'openclaw_adapter_only');
    assert.match(String(degradedStatus.data.warning), /上游 runtime 目前不健康/);

    const degradedReadyRes = await fetch(`http://127.0.0.1:${backendPort}/api/ready`);
    assert.equal(degradedReadyRes.status, 503);

    adapterState.upstreamHealthy = true;

    await waitForCondition(async () => {
      const readyRes = await fetch(`http://127.0.0.1:${backendPort}/api/ready`);
      return readyRes.status === 200;
    });

    const recoveredStatusRes = await fetch(`http://127.0.0.1:${backendPort}/api/runtime/status`);
    assert.equal(recoveredStatusRes.status, 200);
    const recoveredStatus = await recoveredStatusRes.json();
    assert.equal(recoveredStatus.success, true);
    assert.equal(recoveredStatus.data.verified, true);
    assert.equal(recoveredStatus.data.degraded, false);
    assert.equal(recoveredStatus.data.dataSource, 'openclaw_upstream');
    assert.equal(recoveredStatus.data.counts.agents, 1);
    assert.equal(recoveredStatus.data.counts.tasks, 1);
    assert.equal(recoveredStatus.data.counts.events, 1);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    await new Promise<void>((resolve, reject) => {
      adapterServer.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  assert.equal(stderr.includes('EADDRINUSE'), false, 'unexpected port collision during outage/recovery readiness test');
});
