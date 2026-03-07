# ClawVille — AI Agent Office System (Prototype / MVP)

ClawVille is a **prototype dashboard** for monitoring and controlling multi-agent runs.

Current repo state: **MVP in progress**. You can run a working local stack (Next.js + Fastify + WebSocket) with mock/in-memory data, and exercise core operator flows.

Release posture is explicitly split between:
- **Prototype**: suitable for demos/internal validation
- **Production-candidate**: requires passing the full release checklist + runbook preflight

---

## MVP Scope

### What this MVP is for

- Observe agent/task/event state in one UI
- Test basic operator actions (pause/resume agent, retry blocked task)
- Validate realtime update loop (REST snapshot + WS updates)
- Validate Office View UX for role/room visualization

### What this MVP is not (yet)

- No persistent database (state resets on backend restart)
- No authentication / RBAC
- No direct OpenClaw runtime transport wired yet (Round 2 adapter skeleton is in place with strict degraded-mode handling)
- No full production hardening yet (auth/RBAC, audit trail, HA, and formal SLO alerting still pending)

---

## Feature Status

### ✅ Completed

- Dashboard pages: Overview, Agents, Tasks, Events
- Office View (`/office`) with room occupancy and collaboration links
- Backend REST API with stable envelope (`success/data/error`)
- Backend WebSocket (`/ws`) snapshot + state-changed stream
- Agent controls: pause / resume
- Task control: retry
- Frontend realtime state sync via Zustand + WebSocket
- Local build passes for backend and frontend
- Dockerized local/prod-like run path (`backend` + `frontend` via `docker-compose.yml`)
- Baseline ops hooks: request IDs, structured runtime logs, readiness endpoint, and lightweight metrics endpoint

### 🚧 In Progress

- True OpenClaw runtime transport/client implementation behind the Round 2 adapter skeleton
- Production hardening follow-ups (auth/RBAC, auditability, persistence, SLO/alerting)

### 🗺 Planned

- Real OpenClaw adapter (replace in-memory mock store)
- Auth, auditability, and tenancy model
- Advanced analytics (dependency graph, trend charts, playback)
- Operational tooling (alerts, incidents, reliability dashboards)

---

## Runtime Modes

ClawVille currently exposes runtime mode controls on both frontend and backend.

1. **Frontend runtime mode (`NEXT_PUBLIC_RUNTIME_MODE`)**
   - `mock`: frontend serves static fixtures from `frontend/lib/mockData.ts`
   - `local`: backend-first with fallback to local fixtures (default in dev)
   - `real`: strict backend mode with no fallback; failures are surfaced as explicit strict-mode errors
   - Legacy fallback toggle `NEXT_PUBLIC_USE_MOCK_API=true` is still honored for compatibility

2. **Backend runtime source (`RUNTIME_SOURCE`)**
   - `mock`: in-memory `MockRuntimeSource`
   - `openclaw`: Round 2 adapter-ready `OpenClawRuntimeSource` skeleton with injectable client interface and strict degraded-mode signaling when runtime is not configured

   OpenClaw env switches:
   - `OPENCLAW_RUNTIME_ENDPOINT`
   - `OPENCLAW_RUNTIME_API_KEY`
   - `ALLOW_RUNTIME_FALLBACK=false` (default; no silent mock fallback)

3. **True OpenClaw runtime mode (next rounds)**
   - Replace the Round 2 stub client with real transport/client wiring
   - Keep REST + WS contract unchanged so frontend UI does not need rewrites

---

## Architecture (Current MVP)

```text
┌──────────────────────────────┐
│          Frontend            │
│ Next.js app + Zustand store  │
│ runtime modes: mock/local/real│
└──────────────┬───────────────┘
               │ REST (poll/load)
               │ WS (realtime push)
┌──────────────▼───────────────┐
│           Backend            │
│ Fastify API + /ws endpoint   │
│ envelope + readiness/metrics │
└──────────────┬───────────────┘
               │ RuntimeSource contract
┌──────────────▼───────────────┐
│     RuntimeSource Binding    │
│ mode: mock | openclaw        │
└───────┬─────────────────┬────┘
        │                 │
┌───────▼────────┐  ┌─────▼────────────────┐
│ MockRuntime    │  │ OpenClawRuntime      │
│ Source         │  │ Source (Round2 skel) │
└────────────────┘  └──────────────────────┘
```

---

## Integration Flow (Current)

```text
1) Frontend initialize()
   -> GET /api/agents
   -> GET /api/tasks
   -> GET /api/events?limit=100

2) Frontend opens WS /ws
   <- receives "snapshot" with full state

3) User action (pause/resume/retry)
   -> POST /api/agents/:id/pause | /resume
   -> POST /api/tasks/:id/retry

4) Backend mutates store + appends event
   <- WS "state_changed" with updated snapshot (+ triggering event)

5) Frontend store replaces agents/tasks/events from snapshot
```

---

## Local Development

### 1) Start backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend defaults:
- API: `http://localhost:3001/api`
- WS: `ws://localhost:3001/ws`

### 2) Start frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend defaults:
- App: `http://localhost:3000`
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api`
- `NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws`

### 3) Run tests

```bash
cd backend && npm run test
cd ../frontend && npm run test
```

### 4) Build check

```bash
cd backend && npm run build
cd ../frontend && npm run build
```

### 5) Dockerized local/prod-like run

```bash
docker compose build
docker compose up -d
```

Check service health and readiness:

```bash
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/ready
curl -s http://localhost:3001/api/metrics
```

Stop stack:

```bash
docker compose down
```

---

## Security + Ops Baseline (Round 3)

- Set `CORS_ORIGIN` explicitly in production (avoid permissive wildcard)
- Keep `ALLOW_RUNTIME_FALLBACK=false` in production
- Never commit runtime secrets (`OPENCLAW_RUNTIME_API_KEY`) to git; inject via env/secrets manager
- Use `GET /api/ready` for readiness checks (strict runtime posture)
- Use `GET /api/metrics` and JSON logs for baseline observability

---

## Key Docs

- `docs/api-reference.md` — current REST endpoints and envelopes
- `docs/event-schema.md` — event and WebSocket payload schema
- `docs/roadmap.md` — implementation-aligned roadmap
- `docs/ops-hardening-round3.md` — deployment/ops/security baseline for Round 3
- `docs/release-checklist.md` — prototype vs production-candidate release gate
- `docs/release-runbook.md` — tagged release procedure + rollback steps
- `tasks/backlog.md` — execution backlog
- `tasks/roadmap.md` — sprint-oriented delivery plan
