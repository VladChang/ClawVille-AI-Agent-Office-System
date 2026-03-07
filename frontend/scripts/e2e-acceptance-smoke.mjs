#!/usr/bin/env node

const FRONTEND_BASE = process.env.FRONTEND_BASE_URL ?? 'http://localhost:3000';
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001/api';

const routes = ['/', '/agents', '/tasks', '/events', '/office', '/analytics'];
const apiChecks = ['/health', '/overview', '/agents', '/tasks', '/events?limit=5'];

async function checkUrl(url, expected = 200) {
  const res = await fetch(url, { redirect: 'follow' });
  if (res.status !== expected) {
    throw new Error(`${url} returned HTTP ${res.status}, expected ${expected}`);
  }
  return res;
}

async function run() {
  console.log('Running e2e acceptance smoke checks...');
  console.log(`Frontend: ${FRONTEND_BASE}`);
  console.log(`API: ${API_BASE}`);

  for (const route of routes) {
    const url = `${FRONTEND_BASE}${route}`;
    await checkUrl(url, 200);
    console.log(`✓ Route OK: ${route}`);
  }

  for (const endpoint of apiChecks) {
    const url = `${API_BASE}${endpoint}`;
    const res = await checkUrl(url, 200);
    const body = await res.json();
    if (body?.success !== true) {
      throw new Error(`${url} did not return success=true envelope`);
    }

    if (endpoint === '/health' && body?.data?.ok !== true) {
      throw new Error(`${url} did not return data.ok=true`);
    }

    console.log(`✓ API OK: ${endpoint}`);
  }

  console.log('\nAll smoke checks passed.');
}

run().catch((error) => {
  console.error(`\n✗ Acceptance smoke failed: ${error.message}`);
  process.exit(1);
});
