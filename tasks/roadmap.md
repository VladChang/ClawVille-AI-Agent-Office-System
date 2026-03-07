# Project Roadmap (Execution View)

Sprint-style execution view, synchronized with current implementation.

## Completed

### Foundation + Product Surface
- Dashboard pages + shared shell
- Office and Analytics experiences
- Frontend store and realtime synchronization

### Runtime + Contracts
- REST/WS contract stabilization
- RuntimeSource abstraction in backend
- Frontend runtime contract parsing/normalization
- Runtime mode controls (mock/local/real frontend, mock/openclaw backend)

### Reliability + Delivery
- CI validation for backend/frontend + acceptance smoke
- Test baseline across API/runtime/analytics/schema
- WS reconnect/degraded UX behavior
- Dockerized run path + readiness/metrics endpoints
- Release runbook + tagged-release script + rollback guidance

## Current Active Track

- Real OpenClaw runtime hookup (replace stub client while preserving contracts)

## Next Milestones

### Milestone 1 — Real Runtime Hookup
- Implement OpenClaw transport in `OpenClawRuntimeSource`
- Support snapshot/list/control/subscribe against real runtime
- Add integration fixtures and regression tests

### Milestone 2 — Security + Persistence
- Add persistence layer for history
- Add auth/RBAC and audit logs

### Milestone 3 — Production Observability
- Expand metrics and alerts
- Add scale/perf/failure-mode validation
- Harden deployment automation
