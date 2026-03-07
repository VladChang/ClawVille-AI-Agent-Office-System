# API Reference (Current MVP)

Base URL (local default): `http://localhost:3001/api`

## Response Envelope

### Success

```json
{
  "success": true,
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Task not found"
  }
}
```

Common error codes currently used:
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `RUNTIME_NOT_CONFIGURED`
- `RUNTIME_UNAVAILABLE`

---

## Endpoints

## Runtime Source Boundary (P1.5)

Backend route handlers now read/write through a `RuntimeSource` abstraction (`backend/src/runtime/runtimeSource.ts`) instead of directly binding to the in-memory store.

Current binding is env-driven via `RUNTIME_SOURCE`:
- `mock` -> `MockRuntimeSource` (`backend/src/runtime/mockRuntimeSource.ts`)
- `openclaw` -> `OpenClawRuntimeSource` Round 2 adapter skeleton (`backend/src/runtime/openclawRuntimeSource.ts`)

OpenClaw runtime env vars:
- `OPENCLAW_RUNTIME_ENDPOINT`
- `OPENCLAW_RUNTIME_API_KEY`
- `ALLOW_RUNTIME_FALLBACK=false` by default (strict mode)

Round 2 behavior:
- If runtime client is not configured and fallback is disabled, API returns `503` with `RUNTIME_NOT_CONFIGURED`.
- If `ALLOW_RUNTIME_FALLBACK=true`, backend can proxy to mock runtime for non-production/dev continuity.

Contract boundary for future adapters:
- API routes keep the same HTTP paths and response envelope (`success/data/error`)
- Runtime adapter must provide equivalent snapshot/list/control operations:
  - snapshot/overview: `getSnapshot`, `getOverview`
  - list reads: `listAgents`, `listTasks`, `listEvents`
  - control writes: `addAgent`, `pauseAgent`, `resumeAgent`, `addTask`, `updateTaskStatus`, `retryTask`
  - realtime hook: `onStateChange`

This allows swapping in an OpenClaw-backed runtime adapter later without changing API route definitions.

## `GET /health`
Health check.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "ok": true,
    "ts": "2026-03-07T12:00:00.000Z"
  }
}
```

## `GET /overview`
Returns aggregate counters and status breakdown.

## `GET /agents`
Returns all agents.

## `POST /agents`
Create a new agent.

**Body**
```json
{
  "name": "Luna",
  "role": "Reviewer",
  "status": "idle"
}
```

Required: `name`, `role`.
Optional `status`: `idle | busy | offline` (default `idle`).

## `POST /agents/:id/pause`
Sets agent status to `offline`.

## `POST /agents/:id/resume`
Sets agent status to `idle`.

## `GET /tasks`
Returns all tasks.

## `POST /tasks`
Create a task.

**Body**
```json
{
  "title": "Wire CI badge",
  "description": "Add build badge to README",
  "assigneeAgentId": "a-2",
  "status": "todo",
  "priority": "medium"
}
```

Required: `title`, `priority`.

`priority`: `low | medium | high`

Optional `status`: `todo | in_progress | blocked | done` (default `todo`).

## `PATCH /tasks/:id/status`
Update task status.

**Body**
```json
{
  "status": "done"
}
```

## `POST /tasks/:id/retry`
Sets task status to `in_progress`.

## `GET /events`
Returns all events.

## `GET /events?limit=20`
Returns last `limit` events.

---

## Data Shapes

## Agent

```json
{
  "id": "a-1",
  "name": "Nova",
  "role": "Planner",
  "status": "busy",
  "updatedAt": "2026-03-07T12:00:00.000Z"
}
```

## Task

```json
{
  "id": "t-1",
  "title": "Bootstrap backend skeleton",
  "description": "Set up API and realtime endpoint",
  "assigneeAgentId": "a-2",
  "status": "in_progress",
  "priority": "high",
  "createdAt": "2026-03-07T12:00:00.000Z",
  "updatedAt": "2026-03-07T12:00:00.000Z"
}
```

## Event

```json
{
  "id": "e-1",
  "type": "task_updated",
  "message": "Task updated: Bootstrap backend skeleton -> done",
  "timestamp": "2026-03-07T12:00:00.000Z",
  "metadata": {
    "taskId": "t-1",
    "status": "done"
  }
}
```
