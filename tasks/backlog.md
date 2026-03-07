# Task Backlog (Current MVP)

Prioritized backlog aligned with what is already implemented.

## Done

- [x] Frontend scaffold (Next.js + Tailwind + Zustand)
- [x] Core data models for agent/task/event
- [x] Dashboard pages and shared layout
- [x] Backend REST + WebSocket server scaffold
- [x] API envelope standardization
- [x] Agent control endpoints (pause/resume)
- [x] Task retry endpoint
- [x] Frontend realtime snapshot sync
- [x] Office view with room-based visualization

## In Progress

- [ ] Publish concise API reference from actual code
- [ ] Document websocket/event payload schema
- [ ] Clarify runtime modes and integration boundaries in README
- [ ] Reconcile docs roadmap/tasks roadmap with shipped features

## Backlog

### P0 / Near-term

1. Add request validation schemas for create/update endpoints
2. Add API contract tests for envelope + status codes
3. Define and implement real runtime adapter interface (OpenClaw source)
4. Add "connection state" UX for websocket (connected/reconnecting/degraded)

### P1

5. Persist state/events (SQLite or Postgres)
6. Add auth and role-based control permissions
7. Add richer event filtering/search and pagination
8. Make analytics page compute real metrics from store

### P2

9. Add dependency graph view
10. Add incident/event playback timeline
11. Add export/reporting endpoints

## Improvements

- Improve event severity mapping (server-provided level instead of client heuristic)
- Add typed SDK client for frontend API calls
- Add E2E coverage for pause/resume/retry + WS update loop
- Add load/perf baseline for 50+ agents and high event throughput
