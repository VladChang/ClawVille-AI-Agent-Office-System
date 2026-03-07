# Development Roadmap (Implementation-Aligned)

This roadmap reflects the current shipped state in `main`.

## Done

- Dashboard foundation: Overview / Agents / Tasks / Events / Office / Analytics pages
- Backend REST + WebSocket contracts (`success/data/error`, snapshot/state_changed)
- Core operator actions: pause/resume agent, retry task, task status update
- Shared frontend schema/runtime contract guards and mapping transformers
- CI baseline: backend check/build + frontend test/build + acceptance smoke
- Resilience UX: loading/empty/degraded/disconnected consistency + WS reconnect backoff
- Runtime integration hardening:
  - RuntimeSource abstraction in backend
  - `RUNTIME_SOURCE=mock|openclaw` binding
  - OpenClaw adapter Round 2 skeleton + strict degraded signaling
- Ops baseline (Round 3):
  - Dockerfiles + `docker-compose.yml`
  - `/api/health`, `/api/ready`, `/api/metrics`
  - request-id correlation + structured logs
- Release hardening (Round 4):
  - readiness/metrics-aware acceptance smoke
  - tagged release script + runbook
  - rollback checklist/flow

## In Progress

- Real OpenClaw transport/client implementation behind `OpenClawRuntimeSource`
- Production posture completion:
  - auth/RBAC
  - persistence
  - audit trail
  - alerting/SLO thresholds

## Backlog (Next Order)

### Phase A — Real Runtime Data Plane

- Implement actual OpenClaw client transport and event subscription
- Map live runtime entities/events to existing RuntimeSource contract
- Add integration tests for non-stub openclaw mode

### Phase B — Persistence + Security

- Persist agents/tasks/events history (SQLite/Postgres)
- Add authentication + role-based controls
- Add operator audit logging and policy guards

### Phase C — Operations + Scale

- Expand metrics (error budgets, WS reconnect counters, queue latency)
- Add alert thresholds/dashboards
- Add performance and failure-mode test suites for larger workloads
