#!/usr/bin/env node

const FRONTEND_BASE = process.env.FRONTEND_BASE_URL ?? 'http://localhost:3000';
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001/api';

const CHECK_READY = (process.env.ACCEPTANCE_CHECK_READY ?? 'false').toLowerCase() === 'true';
const CHECK_METRICS = (process.env.ACCEPTANCE_CHECK_METRICS ?? 'false').toLowerCase() === 'true';
const READY_MODE = process.env.ACCEPTANCE_READY_MODE ?? 'graceful'; // graceful | ready | not-ready

const routeChecks = [
  { route: '/', expectedLabels: ['系統快照', '近期事件'] },
  { route: '/agents', expectedLabels: ['代理人列表', '搜尋名稱、別名或角色'] },
  { route: '/tasks', expectedLabels: ['任務清單', '搜尋任務'] },
  { route: '/events', expectedLabels: ['事件時間軸', '全部等級'] },
  { route: '/office', expectedLabels: ['辦公室視圖', '辦公室地圖', '協作訊號'] },
  { route: '/analytics', expectedLabels: ['衍生指標', '事件回放'] }
];

const sharedLayoutLabels = ['ClawVille 控制台', '總覽', '代理人', '任務', '事件', '分析', '辦公室'];

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

async function checkReady() {
  const url = `${API_BASE}/ready`;
  const res = await fetch(url, { redirect: 'follow' });

  if (READY_MODE === 'ready') {
    if (res.status !== 200) throw new Error(`${url} returned HTTP ${res.status}, expected 200 in ready mode`);
    const body = await res.json();
    if (body?.success !== true || body?.data?.ok !== true) {
      throw new Error(`${url} did not return success=true and data.ok=true in ready mode`);
    }
    return;
  }

  if (READY_MODE === 'not-ready') {
    if (res.status !== 503) throw new Error(`${url} returned HTTP ${res.status}, expected 503 in not-ready mode`);
    const body = await res.json();
    if (body?.success !== false || body?.error?.code !== 'NOT_READY') {
      throw new Error(`${url} did not return NOT_READY payload in not-ready mode`);
    }
    return;
  }

  // graceful mode: accept either strict degraded or ready payload
  if (![200, 503].includes(res.status)) {
    throw new Error(`${url} returned HTTP ${res.status}, expected 200 or 503 in graceful mode`);
  }

  const body = await res.json();
  if (res.status === 200) {
    if (body?.success !== true || body?.data?.ok !== true) {
      throw new Error(`${url} returned 200 but payload was not ready-shaped`);
    }
  } else if (body?.success !== false || body?.error?.code !== 'NOT_READY') {
    throw new Error(`${url} returned 503 but payload was not strict NOT_READY`);
  }
}

async function checkMetrics() {
  const url = `${API_BASE}/metrics`;
  const res = await checkUrl(url, 200);
  const body = await res.text();
  const contentType = res.headers.get('content-type') ?? '';

  if (!contentType.includes('text/plain')) {
    throw new Error(`${url} returned unexpected content-type: ${contentType}`);
  }

  if (!body.includes('# HELP clawville_http_requests_total') || !body.includes('# TYPE clawville_http_requests_total counter')) {
    throw new Error(`${url} did not include expected Prometheus metric headers`);
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

  if (CHECK_READY) {
    await checkReady();
    console.log(`✓ API OK: /ready (${READY_MODE})`);
  } else {
    console.log('• Skipping /ready check (set ACCEPTANCE_CHECK_READY=true to enable)');
  }

  if (CHECK_METRICS) {
    await checkMetrics();
    console.log('✓ API OK: /metrics');
  } else {
    console.log('• Skipping /metrics check (set ACCEPTANCE_CHECK_METRICS=true to enable)');
  }

  console.log('\nAll smoke checks passed.');
}

run().catch((error) => {
  console.error(`\n✗ Acceptance smoke failed: ${error.message}`);
  process.exit(1);
});
