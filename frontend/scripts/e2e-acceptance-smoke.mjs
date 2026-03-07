#!/usr/bin/env node

const FRONTEND_BASE = process.env.FRONTEND_BASE_URL ?? 'http://localhost:3000';
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001/api';

const routeChecks = [
  { route: '/', expectedLabels: ['System Snapshot', 'Recent Events'] },
  { route: '/agents', expectedLabels: ['Agents', 'Search name or role'] },
  { route: '/tasks', expectedLabels: ['Tasks', 'Search tasks'] },
  { route: '/events', expectedLabels: ['Event Timeline', 'All levels'] },
  { route: '/office', expectedLabels: ['Office View', 'Office Map', 'Collaboration Signals'] },
  { route: '/analytics', expectedLabels: ['Derived Metrics', 'Incident Playback'] }
];

const sharedLayoutLabels = ['ClawVille Office', 'Overview', 'Agents', 'Tasks', 'Events', 'Analytics', 'Office'];

const apiChecks = [
  { endpoint: '/health', expectedData: (body) => body?.data?.ok === true, message: 'data.ok=true' },
  { endpoint: '/overview' },
  { endpoint: '/agents' },
  { endpoint: '/tasks' },
  { endpoint: '/events?limit=5' }
];

async function checkUrl(url, expected = 200) {
  const res = await fetch(url, { redirect: 'follow' });
  if (res.status !== expected) {
    throw new Error(`${url} returned HTTP ${res.status}, expected ${expected}`);
  }
  return res;
}

function assertLabels(content, labels, context) {
  const missing = labels.filter((label) => !content.includes(label));
  if (missing.length > 0) {
    throw new Error(`${context} missing expected labels: ${missing.join(', ')}`);
  }
}

async function checkRoute(route, expectedLabels) {
  const url = `${FRONTEND_BASE}${route}`;
  const res = await checkUrl(url, 200);
  const html = await res.text();

  assertLabels(html, sharedLayoutLabels, `${route} shared layout`);
  assertLabels(html, expectedLabels, `${route} content`);
}

async function checkApi(endpoint, expectedData, expectedDataMessage) {
  const url = `${API_BASE}${endpoint}`;
  const res = await checkUrl(url, 200);
  const body = await res.json();

  if (body?.success !== true) {
    throw new Error(`${url} did not return success=true envelope`);
  }

  if (expectedData && !expectedData(body)) {
    throw new Error(`${url} did not return expected ${expectedDataMessage ?? 'data shape'}`);
  }
}

async function run() {
  console.log('Running e2e acceptance smoke checks...');
  console.log(`Frontend: ${FRONTEND_BASE}`);
  console.log(`API: ${API_BASE}`);

  for (const { route, expectedLabels } of routeChecks) {
    await checkRoute(route, expectedLabels);
    console.log(`✓ Route OK: ${route} (status + content)`);
  }

  for (const { endpoint, expectedData, message } of apiChecks) {
    await checkApi(endpoint, expectedData, message);
    console.log(`✓ API OK: ${endpoint}`);
  }

  console.log('\nAll smoke checks passed.');
}

run().catch((error) => {
  console.error(`\n✗ Acceptance smoke failed: ${error.message}`);
  process.exit(1);
});
