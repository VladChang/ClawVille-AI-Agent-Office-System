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
- Env-based runtime source selection via `RUNTIME_SOURCE` (`mock` | `openclaw`)
  - `openclaw` is a Round 2 adapter skeleton with injectable runtime client interfaces
  - strict degraded behavior by default when runtime client is not configured (`RUNTIME_NOT_CONFIGURED`)
  - optional non-production fallback: `ALLOW_RUNTIME_FALLBACK=true`

## Quick Start

```bash
cd backend
npm install
cp .env.example .env
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
- `npm run test` — run backend API tests (Node test runner via `tsx`)
- `npm run check` — type-check + tests

## REST Endpoints

- `GET /api/health`
- `GET /api/ready`
- `GET /api/metrics`
- `GET /api/overview`
- `GET /api/agents`
- `POST /api/agents`
- `POST /api/agents/:id/pause`
- `POST /api/agents/:id/resume`
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
