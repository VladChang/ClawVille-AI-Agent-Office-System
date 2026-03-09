#!/usr/bin/env node

const API_BASE = process.env.API_BASE_URL ?? 'http://127.0.0.1:3001/api';

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }

  const body = await response.json();
  if (body?.success !== true) {
    throw new Error(`${path} did not return success=true envelope`);
  }

  return body.data;
}

async function main() {
  const runtimeStatus = await fetchJson('/runtime/status');

  if (runtimeStatus.mode !== 'openclaw') {
    throw new Error(`Runtime mode is ${runtimeStatus.mode}, expected openclaw`);
  }

  if (runtimeStatus.dataSource !== 'openclaw_upstream' || runtimeStatus.verified !== true) {
    throw new Error(
      `Runtime is not verified against real upstream. dataSource=${runtimeStatus.dataSource}, verified=${runtimeStatus.verified}`
    );
  }

  const [overview, agents, tasks, events] = await Promise.all([
    fetchJson('/overview'),
    fetchJson('/agents'),
    fetchJson('/tasks'),
    fetchJson('/events?limit=50')
  ]);

  console.log(JSON.stringify({
    ok: true,
    runtime: runtimeStatus,
    counts: {
      overviewAgents: overview?.counts?.agents ?? null,
      agents: Array.isArray(agents) ? agents.length : null,
      tasks: Array.isArray(tasks) ? tasks.length : null,
      events: Array.isArray(events) ? events.length : null
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(`[verify-openclaw-upstream] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
