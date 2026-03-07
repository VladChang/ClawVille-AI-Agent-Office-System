# Development Roadmap (Implementation-Aligned)

This roadmap reflects the **current MVP codebase**, not just aspirational plans.

## Done

- Next.js dashboard skeleton with shared layout and navigation
- Pages: Overview, Agents, Tasks, Events, Office, Analytics placeholder
- Zustand-based shared client state
- Backend Fastify API with stable envelope (`success/data/error`)
- Core REST resources: overview, agents, tasks, events
- Control actions: pause/resume agent, retry task, update task status
- WebSocket realtime channel with initial snapshot + state updates
- Office View with room grouping, occupancy chips, and collaboration links
- Local dev setup and build pipeline for frontend/backend
- Round 1 runtime integration scaffold:
  - Backend env-based runtime source selection (`RUNTIME_SOURCE=mock|openclaw`)
  - Placeholder `OpenClawRuntimeSource` with safe proxy-to-mock fallback + startup mode logging
  - Frontend strict `real` mode error surfacing + tests

## In Progress

- Documentation hardening (API reference + event schema + MVP scope clarity)
- Tightening adapter contract tests before real runtime integration

## Backlog (Next)

- OpenClaw runtime adapter Round 2+ (replace Round 1 proxy internals with real OpenClaw read/write operations while preserving `RuntimeSource` contract)
- Persistent storage for agents/tasks/events history
- Authentication and role-based controls
- Better error taxonomy + validation schemas per endpoint
- Robust reconnect/backfill behavior for websocket clients

## Improvements / Productionization

- Observability: structured logs, metrics, tracing
- Reliability: idempotent commands, retries, circuit-breaking
- Security: authN/authZ, audit log, rate limiting, CORS hardening
- UX polish: richer analytics, timeline playback, performance tuning for larger agent counts
