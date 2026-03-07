# Sprint 4 E2E Acceptance (Manual + Scriptable)

This is a minimal acceptance flow for local verification of Sprint 4 quality.

## Scope

- Frontend pages: `/`, `/agents`, `/tasks`, `/events`, `/office`, `/analytics`
- Backend API: health + core read endpoints
- Realtime: WebSocket snapshot/event stream

## Prerequisites

- Node.js 20+
- Backend and frontend dependencies installed

## A) Manual Acceptance

### 1) Start services

Terminal A:

```bash
cd backend
npm run dev
```

Terminal B:

```bash
cd frontend
npm run dev
```

### 2) Route checks (browser)

Open each route and confirm it renders without crash:

- `http://localhost:3000/`
- `http://localhost:3000/agents`
- `http://localhost:3000/tasks`
- `http://localhost:3000/events`
- `http://localhost:3000/office`
- `http://localhost:3000/analytics`

Expected:

- Shared shell (sidebar + summary bar) is visible
- No blocking runtime error overlay
- `/office` shows room map + agents (or empty-state message)
- `/analytics` shows derived metrics card area and timeline panel

### 3) API sanity checks

```bash
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/overview
curl -s http://localhost:3001/api/agents
curl -s http://localhost:3001/api/tasks
curl -s "http://localhost:3001/api/events?limit=5"
```

Expected:

- All return HTTP 200
- Response envelope has `success: true`
- Health response includes `data.ok: true`

### 4) WebSocket sanity check

```bash
npx wscat -c ws://localhost:3001/ws
```

Expected:

- Initial `snapshot` message
- Follow-up `event` messages on interval

## B) Scriptable Acceptance (added)

A lightweight smoke script is available in frontend package scripts.

```bash
cd frontend
npm run acceptance:e2e
```

What it checks:

1. Frontend routes return HTTP 200 for:
   - `/`, `/agents`, `/tasks`, `/events`, `/office`, `/analytics`
2. Backend endpoints return HTTP 200 and `success: true` envelope:
   - `/api/health`, `/api/overview`, `/api/agents`, `/api/tasks`, `/api/events?limit=5`
3. Health endpoint includes `data.ok: true`

### Optional custom base URLs

If ports/hosts differ:

```bash
FRONTEND_BASE_URL=http://localhost:3000 API_BASE_URL=http://localhost:3001/api npm run acceptance:e2e
```

## Pass Criteria

- Manual checks complete without blocking errors
- Scripted smoke check ends with `All smoke checks passed.`
