# ClawVille Frontend

Next.js dashboard connected to ClawVille backend REST + WebSocket.

## Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Default app URL: `http://localhost:3000`

## Environment

- `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3001/api`)
- `NEXT_PUBLIC_WS_URL` (default `ws://localhost:3001/ws`)
- `NEXT_PUBLIC_RUNTIME_MODE` (`mock` | `local` | `real`)
  - `mock`: frontend fixtures only
  - `local`: backend-first with mock fallback
  - `real`: strict backend mode (no fallback)
- `NEXT_PUBLIC_USE_MOCK_API` (`false` by default, legacy compatibility flag)

When `NEXT_PUBLIC_RUNTIME_MODE=real`, runtime failures are surfaced as strict-mode errors in dashboard state so operators can immediately see configuration/runtime issues.

## Tests

```bash
npm run test
```

Covers frontend logic for schema normalization and analytics metric calculations.

## Build

```bash
npm run build
```

## Office View (Sprint 3)

- Route: `/office`
- Realtime room map + agent cards from shared dashboard state
- Occupancy chips per room
- Collaboration signal list and animated flow lines to Collaboration Hub
- Click-to-select agents stays in sync with drawer and Agents page highlight
