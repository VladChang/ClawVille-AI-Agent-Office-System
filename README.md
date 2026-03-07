# ClawVille — AI Agent Office System (Prototype / MVP)

ClawVille is a **prototype dashboard** for monitoring and controlling multi-agent runs.

Current repo state: **MVP in progress**. You can run a working local stack (Next.js + Fastify + WebSocket) with mock/in-memory data, and exercise core operator flows.

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
- No production hardening (rate limit, audit log, HA, etc.)

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

### 🚧 In Progress

- API and event schema docs formalization (this batch)
- Runtime mode framing (mock vs local integration vs real runtime)
- Round 2 backend runtime source selection scaffold (`RUNTIME_SOURCE=mock|openclaw`) with strict not-configured signaling
- Roadmap/backlog alignment with actual shipped MVP behavior

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
│ pages: overview/agents/...   │
└──────────────┬───────────────┘
               │ REST (poll/load)
               │ WS (realtime push)
┌──────────────▼───────────────┐
│           Backend            │
│ Fastify API + /ws endpoint   │
│ response envelope + controls │
└──────────────┬───────────────┘
               │ in-memory state/events
┌──────────────▼───────────────┐
│         Mock Store           │
│ agents/tasks/events/overview │
│ + random state mutation      │
└──────────────────────────────┘
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

---

## Key Docs

- `docs/api-reference.md` — current REST endpoints and envelopes
- `docs/event-schema.md` — event and WebSocket payload schema
- `docs/roadmap.md` — implementation-aligned roadmap
- `tasks/backlog.md` — execution backlog
- `tasks/roadmap.md` — sprint-oriented delivery plan
