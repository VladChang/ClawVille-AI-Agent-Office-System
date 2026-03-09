# ClawVille Backend

TypeScript + Fastify backend for ClawVille dashboard integration.

## Features

- REST API with stable response envelope:
  - Success: `{ "success": true, "data": ... }`
  - Error: `{ "success": false, "error": { "code", "message" } }`
- In-memory models for agents / tasks / events
- Agent controls:
  - `POST /api/agents/:id/pause`
  - `POST /api/agents/:id/resume`
- Task control:
  - `POST /api/tasks/:id/retry`
- Realtime WebSocket (`/ws`) with snapshot + state updates
- Configurable CORS via `CORS_ORIGIN` (set explicitly in production)
- Structured JSON runtime logs with request IDs (`x-request-id`)
- Lightweight metrics endpoint (`GET /api/metrics`, Prometheus text format)
- Readiness endpoint (`GET /api/ready`) for strict runtime configuration checks
- Request validation schemas with consistent `VALIDATION_ERROR` envelopes for mutation/query failures
- Env-based runtime source selection via `RUNTIME_SOURCE` (`mock` | `openclaw`)
  - `openclaw` supports fixture transport and adapter-backed HTTP/JSON runtime transport behind the same runtime boundary
  - snapshot/list/control are backed by real async transport calls when `OPENCLAW_ADAPTER_ENDPOINT` is configured
  - realtime subscription uses polling-based snapshot change detection with timeout/backoff controls (`OPENCLAW_RUNTIME_POLL_MS`, `OPENCLAW_RUNTIME_POLL_MAX_BACKOFF_MS`, `OPENCLAW_RUNTIME_REQUEST_TIMEOUT_MS`)
  - strict degraded behavior by default when runtime client is not configured (`RUNTIME_NOT_CONFIGURED`)
  - optional non-production fallback: `ALLOW_RUNTIME_FALLBACK=true`

## Quick Start

```bash
npm run bootstrap
```

Manual backend-only dev mode:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Defaults:

- Base URL: `http://localhost:3001`
- API prefix: `/api`
- WS URL: `ws://localhost:3001/ws`

## Scripts

- `npm run dev` — watch mode
- `npm run build` — compile TypeScript
- `npm start` — run compiled server
- `npm run test` — broader backend suite (currently includes hanging auth/audit coverage still being fixed)
- `npm run test:ci` — stable scoped backend suite used by CI and release preflight
- `npm run check` — type-check + stable scoped CI tests
- `npm run check:full` — type-check + broader backend suite

## REST Endpoints

- `GET /api/health`
- `GET /api/ready`
- `GET /api/metrics`
- `GET /api/overview`
- `GET /api/agents`
- `POST /api/agents`
- `POST /api/agents/:id/pause`
- `POST /api/agents/:id/resume`
- `PATCH /api/agents/:id/display-name`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id/status`
- `POST /api/tasks/:id/retry`
- `GET /api/events`
- `GET /api/events?limit=20`

## WebSocket

Connect to `ws://localhost:3001/ws`.

Message shape:

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

Data is in-memory and resets on restart.
