# ClawVille - AI Agent Office System

ClawVille is a visual dashboard for OpenClaw multi-agent systems.

## Repo Contents

- `frontend/` — Next.js dashboard
- `backend/` — Fastify API + WebSocket server
- `docs/` — architecture / UX notes
- `tasks/` — roadmap + backlog
- `agents/` — draft role descriptions

## Integrated Local Dev (Sprint 2)

### Prerequisites

- Node.js 20+
- npm 9+

### 1) Start backend (Terminal A)

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend defaults:

- API: `http://localhost:3001/api`
- WS: `ws://localhost:3001/ws`

### 2) Start frontend (Terminal B)

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend defaults:

- App: `http://localhost:3000`
- API base: `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api`
- WS URL: `NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws`

### 3) Open app

Visit `http://localhost:3000`.

## Build Check

```bash
cd backend && npm run build
cd ../frontend && npm run build
```

## Integration Notes

- Frontend runtime path uses backend REST + WebSocket.
- Mock data remains for local fallback/development mode only.
- Backend returns stable API envelopes (`success/data/error`).
- Agent controls and task retry emit realtime updates.
