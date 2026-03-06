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
- Configurable CORS via `CORS_ORIGIN`

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
- `npm run check` — type-check only

## REST Endpoints

- `GET /api/health`
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
