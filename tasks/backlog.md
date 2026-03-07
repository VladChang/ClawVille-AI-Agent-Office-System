# Task Backlog (Current State)

Prioritized task list aligned to the current repository.

## Done

- [x] Frontend scaffold + shared layout + state store
- [x] Core dashboard pages and Office/Analytics views
- [x] Backend REST + WebSocket MVP contracts
- [x] Pause/resume/retry control flows
- [x] Runtime contract/schema normalization layer (frontend)
- [x] RuntimeSource abstraction and env-based runtime binding (backend)
- [x] CI expansion (backend + frontend + acceptance smoke)
- [x] Baseline tests (backend API/runtime contract + frontend schema/analytics/runtime)
- [x] Degraded/reconnect UX consistency
- [x] Docker + readiness/metrics + ops baseline docs
- [x] Release runbook and rollback-oriented release checklist

## In Progress

- [ ] Implement real OpenClaw transport/client in `OpenClawRuntimeSource`
- [ ] Validate live runtime mapping with integration fixtures

## Backlog

### P0 (Next)

1. Replace Round 2 stub OpenClaw client with real data-plane implementation
2. Add real-runtime integration tests (snapshot/list/control/event subscription)
3. Add request validation schemas for mutation endpoints

### P1

4. Add durable persistence for event/state history
5. Add auth + RBAC for control operations
6. Add operator audit log trail

### P2

7. Expand metrics and dashboards (reconnect/error budget/latency)
8. Add higher-volume performance + outage/failure-mode testing
9. Add deployment automation for release/rollback workflows

## Improvements

- Move event severity derivation to backend-provided canonical levels
- Add typed SDK client for frontend API and runtime contracts
- Add stricter contract checks for WS payload drift
