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
- No direct OpenClaw runtime integration yet (real adapter still planned)
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
- Roadmap/backlog alignment with actual shipped MVP behavior

### 🗺 Planned

- Real OpenClaw adapter (replace in-memory mock store)
- Auth, auditability, and tenancy model
- Advanced analytics (dependency graph, trend charts, playback)
- Operational tooling (alerts, incidents, reliability dashboards)

---

## Runtime Modes

ClawVille is designed to operate in 3 modes:

1. **Mock mode (frontend-only fallback)**
   - Enable with `NEXT_PUBLIC_USE_MOCK_API=true`
   - Frontend serves static mock agents/tasks/events from `frontend/lib/mockData.ts`
   - Best for UI prototyping without backend

2. **Local integration mode (current default MVP path)**
   - Frontend + backend both running locally
   - Frontend calls REST (`/api/*`) and subscribes WS (`/ws`)
   - Backend uses in-memory `mockStore` and simulated state changes

3. **Real runtime mode (planned)**
   - Backend adapter reads/writes real OpenClaw runtime data
   - Same frontend contract (REST + WS envelope) is preserved
   - Goal: swap data source without rewriting dashboard UI

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

### 3) Build check

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
