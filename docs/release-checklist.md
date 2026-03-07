# Sprint 4 Release Checklist (Prototype → Production-Candidate Gate)

Use this checklist before creating a release tag.

## 0) Release intent (must choose one)

- [ ] **Prototype build** (internal/demo only)
- [ ] **Production-candidate build** (stricter gate; must satisfy all sections)

> If only prototype criteria pass, do not tag as production-candidate.

## 1) Pre-flight

- [ ] `main` (or release branch) is up to date and CI is green.
- [ ] Working tree is clean (`git status --porcelain` is empty).
- [ ] Backend and frontend env files exist (`backend/.env`, `frontend/.env.local`).
- [ ] Local dependencies installed:
  - [ ] `cd backend && npm ci`
  - [ ] `cd frontend && npm ci`

## 2) Build + static checks (hard gate)

- [ ] Backend check/build passes:
  - [ ] `cd backend && npm run check && npm run build`
- [ ] Frontend test/build passes:
  - [ ] `cd frontend && npm run test && npm run build`

## 3) Runtime smoke

- [ ] Start backend: `cd backend && npm run dev`
- [ ] Start frontend: `cd frontend && npm run dev`
- [ ] Verify pages load (HTTP 200 + visible UI):
  - [ ] `/`
  - [ ] `/agents`
  - [ ] `/tasks`
  - [ ] `/events`
  - [ ] `/office`
  - [ ] `/analytics`

## 4) API + realtime sanity

- [ ] `GET /api/health` returns `success: true` and `data.ok: true`
- [ ] `GET /api/ready` returns expected readiness for target runtime mode
- [ ] `GET /api/metrics` returns Prometheus text payload
- [ ] `GET /api/overview`, `/api/agents`, `/api/tasks`, `/api/events?limit=5` return 200
- [ ] WebSocket endpoint `ws://localhost:3001/ws` emits snapshot/event messages

## 5) Scripted acceptance (required for production-candidate)

With backend (`:3001`) and frontend (`:3000`) running:

```bash
scripts/release/smoke-check.sh
```

(Equivalent manual command)

```bash
cd frontend
ACCEPTANCE_CHECK_READY=true ACCEPTANCE_READY_MODE=graceful ACCEPTANCE_CHECK_METRICS=true npm run acceptance:e2e
```

- [ ] Script completes with `All smoke checks passed.`

## 6) Resilience + degraded-mode acceptance

- [ ] All core pages (`/`, `/agents`, `/tasks`, `/events`, `/office`, `/analytics`) show consistent state UX:
  - [ ] Loading state shown only before first dataset arrives
  - [ ] Empty state shown when list/scope has no rows
  - [ ] Degraded/disconnected banner shown when realtime channel is unstable/offline
- [ ] Realtime status appears in summary bar (`connected`, `connecting`, `degraded`, `disconnected`)
- [ ] Simulate WebSocket interruption and confirm:
  - [ ] Existing data remains visible
  - [ ] UI shows retry countdown message
  - [ ] Client attempts reconnect with exponential backoff
  - [ ] Status returns to `connected` once WS recovers

## 7) Release execution

- [ ] Run tagged release preflight script (recommended):
  - [ ] `scripts/release/tagged-release.sh vX.Y.Z --dry-run`
- [ ] Execute real tag push only after dry-run pass:
  - [ ] `scripts/release/tagged-release.sh vX.Y.Z`

## 8) Rollback plan (must be prepared before tag push)

- [ ] Previous known-good tag identified (`git tag --sort=-creatordate | head`)
- [ ] Rollback command validated:
  - [ ] `git checkout <previous-tag>` (or deployment equivalent)
- [ ] If bad release already tagged/pushed:
  - [ ] Halt rollout / traffic shift
  - [ ] Re-deploy previous known-good tag
  - [ ] Open incident note with root cause + follow-up actions
  - [ ] Keep failed tag for traceability; publish superseding fix tag

## 9) Final sign-off

- [ ] Release notes updated
- [ ] Known issues documented (if any)
- [ ] Sprint owner or release owner sign-off recorded
