import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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

test('GET /api/ready returns 503 NOT_READY in strict openclaw mode when runtime is not configured', async () => {
  const port = await getFreePort();

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
