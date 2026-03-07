# Project Roadmap (Execution View)

Sprint-oriented view derived from current implementation.

## Done (MVP foundation)

- Dashboard UI with Overview / Agents / Tasks / Events
- Office View route with room layout and selection sync
- Backend REST API + WebSocket stream
- In-memory store with agent/task/event mutations
- Control actions wired end-to-end (pause/resume/retry)

## In Progress (stabilization)

- Documentation pass for API/event contracts and runtime modes
- Contract cleanup to support future data-source swap
- Backlog refinement for real-runtime integration

## Backlog (delivery order)

### Phase A — Real Integration

- Introduce runtime adapter abstraction in backend
- Replace mock store source with OpenClaw runtime feeds/controls
- Preserve existing REST/WS response contracts

### Phase B — Persistence & Security

- Add durable state/event persistence
- Add authentication and role-based controls
- Add audit logs for operator actions

### Phase C — Analytics & Operations

- Upgrade analytics page with real derived metrics
- Add dependency graph and event playback
- Add production observability and alert hooks

## Improvements / Quality Gates

- API contract tests (REST + WS envelope)
- E2E smoke tests against local integration mode
- Performance targets for larger agent/event volumes
- Failure-mode tests (backend restart, WS reconnect, partial outage)
