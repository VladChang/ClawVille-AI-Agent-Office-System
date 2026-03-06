# ClawVille Implementation Plan (MVP → Real-time)

## 1) Scope and Planning Assumptions

- This plan covers **first 2 sprints** (suggested: 2 weeks each).
- Goal for Sprint 1: working console with mock data.
- Goal for Sprint 2: live ingestion + control APIs + resilient UI updates.
- Office view and advanced analytics remain post-Sprint-2 (already defined in roadmap).

---

## 2) Milestones

### Milestone M0 — Project Baseline (Day 1–2)
- Repo scaffolding finalized (`frontend/`, `backend/`, CI checks).
- Shared TypeScript contracts package or synced schema file for Agent/Task/Event.
- Local dev workflow documented (`npm run dev`, env template).

### Milestone M1 — Console MVP with Mock Data (Sprint 1)
- Overview, Agents, Tasks, Events pages implemented.
- Sidebar + summary bar + agent detail drawer.
- Filtering/search on agents/tasks.
- Mock control actions (pause/resume/retry) wired in UI state.

### Milestone M2 — Real-time Integration (Sprint 2)
- Backend event ingestion service (OpenClaw stream → normalized state).
- REST read APIs + WebSocket push channel delivered.
- Real control endpoints (pause/resume/retry/reassign) with audit events.
- Frontend switched from mock provider to live API/WebSocket.

### Milestone M3 — Hardening Gate (end Sprint 2)
- Error handling/toasts + reconnect behavior + stale-state indicator.
- Basic health metrics (error count, blocked task count, agent health rollup).
- Demo scenario with simulated failures and retries.

---

## 3) Architecture Decisions (ADR-style)

1. **Backend-for-Frontend (BFF) aggregator**
   - Decision: ClawVille backend owns normalized read-model for Agents/Tasks/Events.
   - Why: isolates frontend from raw OpenClaw event complexity and ordering issues.

2. **Event-driven state materialization**
   - Decision: ingest append-only events, materialize current state in memory (+ optional persistence later).
   - Why: matches observability/debug requirements and supports timeline features.

3. **Transport split: REST for snapshots, WebSocket for deltas**
   - Decision: initial page load via REST; live updates via WebSocket.
   - Why: fast cold start + efficient real-time updates.

4. **Contract-first models**
   - Decision: enforce shared schema for `Agent`, `Task`, `Event` and enums (`status`, `task status`).
   - Why: prevents frontend/backend drift.

5. **Thought-summary safety boundary**
   - Decision: backend emits only short sanitized summaries; no raw chain-of-thought fields in API.
   - Why: explicit product/safety requirement in spec.

6. **Frontend state management**
   - Decision: Zustand store with entity maps (`agentsById`, `tasksById`, `events[]`) and websocket patch reducers.
   - Why: simple, predictable updates for high-frequency events.

7. **Office view deferred**
   - Decision: build only shared selection/state primitives now; render Office page in next phase.
   - Why: protects delivery of operational core first.

---

## 4) API Contract Draft (v1)

## 4.1 REST (read + controls)

### GET `/api/v1/overview`
Returns:
```json
{
  "agentCounts": {"working": 0, "thinking": 0, "waiting": 0, "idle": 0, "retrying": 0, "error": 0},
  "taskCounts": {"running": 0, "waiting": 0, "blocked": 0, "completed": 0, "error": 0},
  "teamHealth": 0,
  "recentCriticalEvents": []
}
```

### GET `/api/v1/agents?status=&role=&q=`
Returns list of Agent objects with optional presentation fields:
```json
{
  "items": [
    {
      "id": "a1",
      "name": "Planner",
      "role": "planner",
      "status": "working",
      "current_task": "t1",
      "progress": 0.42,
      "depends_on": [],
      "collaborating_with": ["a2"],
      "last_event_at": "2026-03-07T00:00:00Z",
      "health_score": 88,
      "mood": "focused",
      "thought_summary": "Breaking the task into smaller steps.",
      "zone": "Planning Room"
    }
  ]
}
```

### GET `/api/v1/agents/:id`
Returns one Agent + recent related events + active task refs.

### GET `/api/v1/tasks?status=&assigned_agent=&q=`
Returns `Task[]` with dependencies.

### GET `/api/v1/events?agent_id=&task_id=&type=&severity=&cursor=`
Cursor-paginated timeline.

### POST `/api/v1/agents/:id/actions`
Body:
```json
{ "action": "pause|resume|retry|reassign", "task_id": "t1", "target_agent_id": "a3" }
```
Returns operation result + emitted audit event id.

## 4.2 WebSocket

Endpoint: `/ws/v1/stream`

Server events:
- `snapshot` (initial optional full payload)
- `agent.upsert`
- `task.upsert`
- `event.append`
- `overview.update`
- `control.ack`
- `control.error`

Envelope:
```json
{
  "type": "agent.upsert",
  "timestamp": "2026-03-07T00:00:00Z",
  "data": {}
}
```

## 4.3 Error Model

REST error:
```json
{ "error": { "code": "INVALID_ACTION", "message": "...", "details": {} } }
```

WebSocket error event:
```json
{ "type": "control.error", "data": { "code": "TIMEOUT", "message": "..." } }
```

---

## 5) Prioritized Issue Breakdown — First 2 Sprints

Legend: **P0** critical path, **P1** important, **P2** stretch.

### Sprint 1 (Console + Mock)

1. **P0: FE scaffold + layout shell**
   - Deliver: Next.js app shell, sidebar, summary bar, route skeleton.
   - AC: all pages routable; responsive baseline.

2. **P0: Shared domain types**
   - Deliver: Agent/Task/Event TS interfaces + status enums.
   - AC: used across all pages; no `any` for core models.

3. **P0: Mock data provider + store**
   - Deliver: Zustand store + mock adapters for overview/agents/tasks/events.
   - AC: deterministic demo seed, hot-reload stable.

4. **P0: Agents page + detail drawer**
   - Deliver: list/table, status chips, search/filter, selectable drawer.
   - AC: selection persists via URL/state.

5. **P1: Tasks page with dependencies**
   - Deliver: sortable tasks list and dependency indicators.
   - AC: blocked/waiting visual distinction clear.

6. **P1: Events timeline page**
   - Deliver: chronological feed with basic filters (agent/type).
   - AC: timestamp ordering and empty/loading states.

7. **P1: Mock controls (pause/resume/retry)**
   - Deliver: UI actions updating local state + generated mock event.
   - AC: action feedback visible within <300ms.

8. **P2: CI baseline**
   - Deliver: lint/typecheck/test job in GitHub Actions.
   - AC: PRs blocked on failing checks.

### Sprint 2 (Live integration + control plane)

1. **P0: Backend ingestion service**
   - Deliver: OpenClaw event consumer → normalized in-memory read model.
   - AC: handles out-of-order/duplicate events idempotently.

2. **P0: REST read endpoints (`overview/agents/tasks/events`)**
   - Deliver: API with filtering + cursor pagination for events.
   - AC: p95 < 300ms on local test dataset.

3. **P0: WebSocket delta stream**
   - Deliver: publish `agent/task/event/overview` updates.
   - AC: reconnect + resync supported.

4. **P0: Real control actions endpoint**
   - Deliver: pause/resume/retry/reassign wired to OpenClaw control interface.
   - AC: success/failure always yields audit event.

5. **P1: Frontend live data integration**
   - Deliver: replace mocks with REST bootstrap + WS updates.
   - AC: no full-page refresh needed for updates.

6. **P1: Error and resilience UX**
   - Deliver: toasts, stale badge, retry connect button.
   - AC: user can detect disconnected state within 5s.

7. **P1: Health summary computation v1**
   - Deliver: backend-derived team health + blocked/error counters.
   - AC: overview numbers match entity states.

8. **P2: Integration test harness**
   - Deliver: replay fixture events and assert expected materialized state.
   - AC: catches ordering/idempotency regressions.

---

## 6) Key Risks and Mitigations

1. **Event schema volatility from OpenClaw**
   - Risk: breaking changes stall integration.
   - Mitigation: adapter layer + versioned internal event schema.

2. **Out-of-order or duplicate events**
   - Risk: inconsistent UI state.
   - Mitigation: monotonic timestamps/sequence where possible + idempotent reducers.

3. **Control-action ambiguity (who is source of truth)**
   - Risk: UI says paused while backend rejects action.
   - Mitigation: optimistic UI only with explicit ack timeout + rollback on `control.error`.

4. **Performance under high event throughput**
   - Risk: UI jank and dropped updates.
   - Mitigation: batched WS patches, virtualized lists, event retention limits.

5. **Thought-summary safety leakage**
   - Risk: exposing sensitive reasoning content.
   - Mitigation: strict sanitization templates, allowlist fields, test fixtures for redaction.
