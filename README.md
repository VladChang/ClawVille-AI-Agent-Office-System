# ClawVille — AI Agent Office System

ClawVille is an **internal dashboard prototype** for observing and operating multi-agent runs.

## Current Project Status

### Done
- Core UI routes are implemented: `/`, `/agents`, `/tasks`, `/events`, `/office`, `/analytics`
- Backend REST + WebSocket contracts are implemented and stable for local integration
- Operator actions available: pause/resume agent, retry task, task status update
- Runtime abstraction boundary exists (`RuntimeSource`) with `mock` and `openclaw` bindings
- Optional local persistence baseline exists for runtime snapshot + transition history (`RUNTIME_PERSISTENCE_ENABLED`)
- Optional internal-use auth/RBAC header gate + operator audit trail endpoint baseline exist (`AUTH_MODE=header`, `/api/audit`)
- OpenClaw HTTP/JSON transport baseline exists for snapshot/list/control operations, plus polling-based subscription when a runtime endpoint is configured
- Local dev, Docker compose run path, and baseline acceptance smoke are in place

### Known Issues
- Full backend `npm run test` still has hanging coverage in the broader API/auth/audit suite. CI is intentionally pinned to a stable scoped backend test set via `backend npm run test:ci` until the remaining hanging cases are fixed.
- Release process docs/checklists exist (prototype and production-candidate gates)

## One-Command Bootstrap

Preferred:

```bash
npm run bootstrap
```

Equivalent:

```bash
bash scripts/bootstrap.sh
```

Behavior:
- Prefers Docker Compose when Docker is available
- Falls back to local Node deployment otherwise
- Auto-creates missing `.env`, `backend/.env`, and `frontend/.env.local` from checked-in examples
- Waits for backend/frontend health before returning

Stop everything:

```bash
npm run stop
```

### In Progress
- OpenClaw transport hardening against real upstream conventions (path tuning, auth header variants, failure handling, push subscription)
- Production hardening: auth/RBAC, persistence, audit trail, stronger alerting/SLO posture

### Next
- Validate the HTTP transport against real upstream OpenClaw deployments
- Add richer upstream outage/reconnect coverage against real non-fixture `openclaw` deployments
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
- `openclaw`: HTTP/JSON runtime transport baseline with strict degraded signaling when runtime config is missing/unready; fixture mode is still supported for local integration

Key env for openclaw mode:
- `OPENCLAW_RUNTIME_ENDPOINT`
- `OPENCLAW_RUNTIME_API_KEY`
- `OPENCLAW_RUNTIME_POLL_MS`
- `OPENCLAW_RUNTIME_POLL_MAX_BACKOFF_MS`
- `OPENCLAW_RUNTIME_REQUEST_TIMEOUT_MS`
- `OPENCLAW_RUNTIME_AUTH_HEADER`
- `OPENCLAW_RUNTIME_AUTH_SCHEME`
- `OPENCLAW_RUNTIME_SNAPSHOT_PATH`
- `OPENCLAW_RUNTIME_AGENTS_PATH`
- `OPENCLAW_RUNTIME_TASKS_PATH`
- `OPENCLAW_RUNTIME_EVENTS_PATH`
- `ALLOW_RUNTIME_FALLBACK=false` (recommended/expected for strict posture)

Current `openclaw` maturity:
- Runtime boundary, env selection, degraded readiness, and fixture-backed tests exist
- HTTP transport covers snapshot/list/control against JSON endpoints, with polling-based snapshot subscription, request timeout, and backoff-based recovery for realtime updates
- Production hardening is still pending: upstream-specific endpoint conventions, richer auth negotiation, and push/event-stream transport

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
  └─ OpenClawRuntimeSource (fixture + HTTP transport baseline; polling subscription)
```

## Shared Contracts

Canonical shared enums and core runtime types now live in [`shared/contracts/index.ts`](shared/contracts/index.ts).

- Backend re-exports these contracts via `backend/src/models/types.ts`
- Frontend consumes them through `frontend/types/models.ts`, `frontend/lib/schema.ts`, `frontend/lib/runtimeContract.ts`, and shared-contract tests
- Shared contracts currently cover the canonical Agent / Task / Event / Overview / RuntimeSnapshot shapes
- Backend runtime/store/api logic now builds on those canonical shapes through the re-export layer
- UI-only fields, derived metrics, room placement, and page-specific presentation state remain frontend concerns
- Remaining migration work is mostly about tightening runtime validation and reducing duplicate interpretation logic, not re-inventing the base shapes

## Start Here (Docs Index)

Suggested reading order for contributors:
1. `README.md`
2. [`docs/data-models.md`](docs/data-models.md)
3. [`docs/integration-checklist.md`](docs/integration-checklist.md)
4. [`docs/e2e-acceptance.md`](docs/e2e-acceptance.md)
5. [`docs/release-checklist.md`](docs/release-checklist.md)
6. [`docs/roadmap.md`](docs/roadmap.md)

- Product overview: [`docs/product-overview.md`](docs/product-overview.md)
- Data models: [`docs/data-models.md`](docs/data-models.md)
- Integration checklist: [`docs/integration-checklist.md`](docs/integration-checklist.md)
- E2E acceptance: [`docs/e2e-acceptance.md`](docs/e2e-acceptance.md)
- Release checklist: [`docs/release-checklist.md`](docs/release-checklist.md)
- Roadmap: [`docs/roadmap.md`](docs/roadmap.md)

## Prototype vs Production Boundary

Maturity labels used below:
- `Stable`: implemented and expected to work for normal internal usage
- `Prototype baseline`: core implementation exists, but hardening depth is limited
- `Internal-only`: usable for local/internal workflows, but not production-grade
- `Production hardening pending`: significant reliability/security/operational work remains
- `Missing`: boundary acknowledged, implementation still incomplete
- `Demo-only`: intentionally optimized for presentation, not operational rigor

| Area | Current state | Boundary |
|---|---|---|
| UI routes & operator flows | Implemented and usable | **Stable** |
| REST/WS contract | Implemented; local integration verified | **Stable** |
| Runtime adapter contract | Abstraction exists; `openclaw` now supports fixture transport and HTTP/JSON transport behind the same boundary | **Prototype baseline** |
| OpenClaw transport wiring | HTTP snapshot/list/control baseline exists, but upstream-specific protocol hardening and push subscription are still incomplete | **Prototype baseline** |
| Persistence (local durable baseline) | File-backed runtime state exists for local/internal durability; database-grade durability and operational safeguards are still absent | **Internal-only** |
| Auth/RBAC | Header-based operator gate exists for internal control flows; real identity/session/authz integration is still incomplete | **Internal-only** |
| Audit trail/compliance logging | Operator audit endpoint + file-backed baseline exist; retention/compliance/export pipeline still needs hardening | **Internal-only** |
| Observability baseline (`health/ready/metrics`) | Implemented | **Stable** |
| Release runbook/checklists | Implemented for internal release discipline | **Prototype baseline** |
| Resilience/degraded UX | Fallback/degraded UX exists, but production incident-handling depth is still limited | **Production hardening pending** |
| Demo friendliness (office view/humanized UI) | Strong | **Demo-only** |

## Quick Local Run

```bash
npm run bootstrap -- --mode local
```

Optional acceptance smoke:

```bash
cd frontend
npm run acceptance:e2e
```

Manual dev mode is still available if you want hot reload:

```bash
cd backend && cp .env.example .env && npm install && npm run dev
cd frontend && cp .env.example .env.local && npm install && npm run dev
```
