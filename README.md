# ClawVille — AI Agent Office System

ClawVille is an **internal dashboard prototype** for observing and operating multi-agent runs.

## Current Project Status

### Done
- Core UI routes are implemented: `/`, `/agents`, `/tasks`, `/events`, `/office`, `/analytics`
- Backend REST + WebSocket contracts are implemented and stable for local integration
- Operator actions available: pause/resume agent, retry task, task status update
- Runtime abstraction exists (`RuntimeSource`) with `mock` and `openclaw` bindings
- Optional durable local persistence baseline for runtime snapshot + transition history (`RUNTIME_PERSISTENCE_ENABLED`)
- Local dev, Docker compose run path, and baseline acceptance smoke are in place
- Release process docs/checklists exist (prototype and production-candidate gates)

### In Progress
- Real OpenClaw transport/client implementation behind `OpenClawRuntimeSource`
- Production hardening: auth/RBAC, persistence, audit trail, stronger alerting/SLO posture

### Next
- Wire live runtime events/data into current RuntimeSource contract
- Add integration tests for non-stub `openclaw` mode
- Complete production gate items and promote from prototype/internal use to production-candidate

## Scope Classification (Explicit)

- **Prototype:** ✅ Yes (actively used for demo/internal validation)
- **MVP:** 🚧 In progress (core flow works; hardening incomplete)
- **Internal dashboard:** ✅ Yes (current intended usage)
- **Production-candidate:** ❌ Not yet (requires full release checklist pass)

## Runtime Modes

### Frontend (`NEXT_PUBLIC_RUNTIME_MODE`)
- `mock`: serve local fixture data
- `local`: call backend first, allow local fallback (dev default)
- `real`: strict backend mode, no silent fallback

Legacy compat: `NEXT_PUBLIC_USE_MOCK_API=true` still supported.

### Backend (`RUNTIME_SOURCE`)
- `mock`: in-memory runtime source
- `openclaw`: adapter skeleton mode; strict degraded signaling when runtime config is missing/unready

Key env for openclaw mode:
- `OPENCLAW_RUNTIME_ENDPOINT`
- `OPENCLAW_RUNTIME_API_KEY`
- `ALLOW_RUNTIME_FALLBACK=false` (recommended/expected for strict posture)

## Architecture Summary

```text
Frontend (Next.js + Zustand)
  ├─ pulls REST snapshots
  └─ subscribes WebSocket updates
        │
        ▼
Backend (Fastify API + /ws)
  ├─ REST envelope: success/data/error
  ├─ WS messages: snapshot/state_changed
  └─ health/ready/metrics endpoints
        │
        ▼
RuntimeSource
  ├─ MockRuntimeSource (in-memory)
  └─ OpenClawRuntimeSource (adapter skeleton; real transport pending)
```

## Start Here (Docs Index)

- Product overview: [`docs/product-overview.md`](docs/product-overview.md)
- Data models: [`docs/data-models.md`](docs/data-models.md)
- Integration checklist: [`docs/integration-checklist.md`](docs/integration-checklist.md)
- E2E acceptance: [`docs/e2e-acceptance.md`](docs/e2e-acceptance.md)
- Release checklist: [`docs/release-checklist.md`](docs/release-checklist.md)
- Roadmap: [`docs/roadmap.md`](docs/roadmap.md)

## Prototype vs Production Boundary

| Area | Current state | Boundary |
|---|---|---|
| UI routes & operator flows | Implemented and usable | **Stable** |
| REST/WS contract | Implemented; local integration verified | **Stable** |
| Runtime adapter contract | Abstraction + openclaw skeleton exists | **Partial** |
| Real OpenClaw transport wiring | Not complete | **Missing** |
| Persistence (DB/history durability) | Not implemented | **Missing** |
| Auth/RBAC | Not implemented | **Missing** |
| Audit trail/compliance logging | Basic logs only; no full audit pipeline | **Partial** |
| Observability baseline (`health/ready/metrics`) | Implemented | **Stable** |
| Release runbook/checklists | Implemented | **Stable** |
| Resilience/degraded UX | Implemented baseline | **Partial** |
| Demo friendliness (office view/humanized UI) | Strong | **Demo-only** |

## Quick Local Run

```bash
# backend
cd backend
npm install
cp .env.example .env
npm run dev

# frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Optional acceptance smoke:

```bash
cd frontend
npm run acceptance:e2e
```
