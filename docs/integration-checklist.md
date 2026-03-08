# Runtime Integration Checklist

Use this checklist after starting backend (`:3001`) and frontend (`:3000`) to verify the current REST + WebSocket runtime flow.

## Setup

- [ ] Preferred startup path: `npm run bootstrap -- --mode local`
- [ ] Or manual dev mode:
  - Backend: `cd backend && npm run dev`
  - Frontend: `cd frontend && npm run dev`
- [ ] Frontend reachable at `http://localhost:3000`
- [ ] Runtime config verified:
  - Backend `.env`: `RUNTIME_SOURCE=mock` (or `openclaw` HTTP transport path)
  - If `RUNTIME_SOURCE=openclaw`, choose one runtime input:
    - Real upstream wiring: set `OPENCLAW_RUNTIME_ENDPOINT`, `OPENCLAW_RUNTIME_API_KEY`
    - Integration fixture wiring: set `OPENCLAW_RUNTIME_FIXTURE_PATH` (or `OPENCLAW_RUNTIME_FIXTURE_JSON`)
  - Optional HTTP transport tuning: `OPENCLAW_RUNTIME_POLL_MS`, `OPENCLAW_RUNTIME_AUTH_HEADER`, `OPENCLAW_RUNTIME_AUTH_SCHEME`, `OPENCLAW_RUNTIME_SNAPSHOT_PATH`, `OPENCLAW_RUNTIME_AGENTS_PATH`, `OPENCLAW_RUNTIME_TASKS_PATH`, `OPENCLAW_RUNTIME_EVENTS_PATH`
  - Treat current `openclaw` mode as a prototype transport baseline: HTTP snapshot/list/control and polling subscription exist, but upstream-specific production hardening may still require tuning
  - Keep `ALLOW_RUNTIME_FALLBACK=false` unless intentionally enabling temporary mock fallback
  - Frontend `.env.local`: `NEXT_PUBLIC_RUNTIME_MODE=local` for fallback-friendly integration checks (or `real` for strict runtime validation)

## REST flow checks

### 1) Health and readiness endpoints

```bash
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/ready
```

- [ ] Health returns JSON with `ok: true`
- [ ] Ready returns 200 in expected mode (or 503 `NOT_READY` in strict degraded openclaw mode)

### 2) Read baseline data

```bash
curl -s http://localhost:3001/api/overview
curl -s http://localhost:3001/api/agents
curl -s http://localhost:3001/api/tasks
curl -s "http://localhost:3001/api/events?limit=5"
```

- [ ] Endpoints respond with JSON and HTTP 200
- [ ] `overview.counts` is present (`agents`, `tasks`, `events`, `activeAgents`, `openTasks`)
- [ ] `curl -s http://localhost:3001/api/metrics` returns Prometheus-formatted text

### 3) Create data via API

Create agent:

```bash
curl -s -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"Integration Bot","role":"QA","status":"idle"}'
```

Create task:

```bash
curl -s -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Manual integration test","priority":"high","status":"todo"}'
```

- [ ] Both endpoints return HTTP 201
- [ ] New records appear in subsequent `GET /api/agents` and `GET /api/tasks`

### 4) Update task status

Use the created task id:

```bash
curl -s -X PATCH http://localhost:3001/api/tasks/<TASK_ID>/status \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress"}'
```

- [ ] Returns HTTP 200 with updated `status`

## WebSocket flow checks

Use any WS client (example with `wscat`):

```bash
npx wscat -c ws://localhost:3001/ws
```

- [ ] First message is `{"type":"snapshot", ...}`
- [ ] Follow-up messages arrive about every 5 seconds as `{"type":"state_changed", ...}`
- [ ] WS connection closes cleanly when client exits

## Frontend sanity checks

- [ ] `http://localhost:3000` loads without runtime error
- [ ] Agents / Tasks / Events pages render
- [ ] No CORS errors appear in browser console

## Done criteria

- [ ] REST read/write endpoints verified
- [ ] WebSocket snapshot + event stream verified
- [ ] Frontend loads and basic pages are accessible
