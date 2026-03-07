# Event & Realtime Schema (Current MVP)

This document describes the **backend event model** and **WebSocket payloads** currently emitted by `backend/src/realtime/websocket.ts`.

## Event Type Enum

Current event types:

- `task_created`
- `task_updated`
- `task_retried`
- `agent_status_changed`
- `agent_paused`
- `agent_resumed`
- `system`

## Event Object

```json
{
  "id": "e-uuid",
  "type": "task_updated",
  "message": "Task updated: Build API -> done",
  "timestamp": "2026-03-07T12:00:00.000Z",
  "metadata": {
    "taskId": "t-1",
    "status": "done"
  }
}
```

Fields:
- `id`: string (UUID)
- `type`: enum above
- `message`: human-readable log line
- `timestamp`: ISO datetime
- `metadata`: optional free-form object

---

## WebSocket Endpoint

- URL: `ws://localhost:3001/ws` (local default)
- Server sends JSON text frames only.

## Message Envelope

```json
{
  "type": "snapshot | state_changed",
  "data": {
    "snapshot": {
      "overview": {},
      "agents": [],
      "tasks": [],
      "events": []
    },
    "event": {}
  }
}
```

Where:
- `type: "snapshot"` → sent immediately after connection opens
- `type: "state_changed"` → sent on any store mutation
- `data.event` is optional in typing, but present for state changes caused by an event

---

## Snapshot Structure

```json
{
  "overview": {
    "generatedAt": "2026-03-07T12:00:00.000Z",
    "counts": {
      "agents": 3,
      "tasks": 2,
      "events": 10,
      "activeAgents": 2,
      "openTasks": 1
    },
    "agentsByStatus": {
      "idle": 1,
      "busy": 1,
      "offline": 1
    },
    "tasksByStatus": {
      "todo": 0,
      "in_progress": 1,
      "blocked": 0,
      "done": 1
    }
  },
  "agents": [],
  "tasks": [],
  "events": []
}
```

---

## Frontend Event Level Mapping

Backend does **not** send a dedicated `level` field.
Frontend derives `level` from `event.type`:

- contains `blocked` or `error` -> `error`
- contains `paused` or `retry` -> `warning`
- otherwise -> `info`

This mapping currently lives in `frontend/lib/schema.ts` and is reused across API normalization and analytics/overview rendering.

---

## Frontend Runtime Contract Guard

For runtime integration hardening, frontend now enforces a dedicated contract adapter layer:
- `frontend/lib/runtimeContract.ts`

It performs:
- safe parsing from unknown API/WS payloads
- required-field checks for agent/task/event entities
- fallback defaults for partial data
- malformed record filtering (skip bad rows, keep stream/UI alive)

Detailed boundary rules are documented in `docs/runtime-adapter-contract.md`.

---

## Runtime Adapter Boundary (P1.5)

Realtime publishing now consumes a runtime-source interface (`backend/src/runtime/runtimeSource.ts`) and is currently wired to the mock implementation.

Adapter requirements for future real-runtime mode:
- `getSnapshot()` must return the same snapshot object shape used by WS `snapshot/state_changed` payloads.
- `onStateChange(listener)` must emit `{ snapshot, event? }` where `event` follows the Event object schema in this doc.
- Control mutations must preserve event semantics (`agent_paused`, `agent_resumed`, `task_retried`, etc.) so frontend mapping remains stable.

The WS envelope and event schema in this document are **adapter-invariant contracts**.

## Realtime Behavior Notes

- On each WS connection, server also starts a `5s` interval that mutates random task/agent state (MVP simulation).
- Store is in-memory; restart clears all runtime events/state.
- Contract target for future real-runtime mode: keep this envelope stable while swapping event source.
