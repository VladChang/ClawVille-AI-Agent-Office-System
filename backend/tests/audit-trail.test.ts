import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import Fastify from 'fastify';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { apiRoutes } from '../src/routes/api';
import { auditTrail } from '../src/audit/auditTrail';

async function createApp() {
  const app = Fastify();
  await app.register(apiRoutes, { prefix: '/api' });
  return app;
}

test('mutation actions are captured in audit trail endpoint', async () => {
  process.env.AUTH_MODE = 'header';
  const app = await createApp();

  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { 'x-operator-id': 'audit-user', 'x-operator-role': 'operator' },
      payload: { title: 'audit task', priority: 'medium' }
    });
    assert.equal(created.statusCode, 201);

    const audit = await app.inject({ method: 'GET', url: '/api/audit?limit=20' });
    assert.equal(audit.statusCode, 200);

    const body = audit.json();
    assert.equal(body.success, true);
    const matched = (body.data as Array<{ action: string; actorId: string; result: string }>).find(
      (entry) => entry.action === 'task.create' && entry.actorId === 'audit-user' && entry.result === 'success'
    );

    assert.ok(matched);
  } finally {
    await app.close();
    delete process.env.AUTH_MODE;
  }
});

test('audit trail flush persists buffered records to file', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'clawville-audit-'));
  const filePath = path.join(dir, 'audit.jsonl');

  process.env.AUDIT_LOG_ENABLED = 'true';
  process.env.AUDIT_LOG_FILE = filePath;

  try {
    auditTrail.record({
      actorId: 'flush-user',
      actorRole: 'operator',
      action: 'system.flush_check',
      targetType: 'system',
      result: 'success'
    });

    await auditTrail.flush();

    const file = readFileSync(filePath, 'utf8');
    assert.match(file, /"actorId":"flush-user"/);
    assert.match(file, /"action":"system\.flush_check"/);
  } finally {
    delete process.env.AUDIT_LOG_ENABLED;
    delete process.env.AUDIT_LOG_FILE;
  }
});
