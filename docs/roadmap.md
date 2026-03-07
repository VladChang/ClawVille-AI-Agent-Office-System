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

## In Progress

- Documentation hardening (API reference + event schema + MVP scope clarity)
- Runtime-source abstraction landed in backend (`RuntimeSource` + `MockRuntimeSource`) with unchanged HTTP/WS contracts
- Tightening adapter contract tests before real runtime integration

## Backlog (Next)

- OpenClaw runtime adapter (implement `RuntimeSource` contract; swap binding in `backend/src/runtime/index.ts` only)
- Persistent storage for agents/tasks/events history
- Authentication and role-based controls
- Better error taxonomy + validation schemas per endpoint
- Robust reconnect/backfill behavior for websocket clients

## Improvements / Productionization

- Observability: structured logs, metrics, tracing
- Reliability: idempotent commands, retries, circuit-breaking
- Security: authN/authZ, audit log, rate limiting, CORS hardening
- UX polish: richer analytics, timeline playback, performance tuning for larger agent counts
