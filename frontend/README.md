# ClawVille Frontend

Next.js dashboard connected to ClawVille backend REST + WebSocket.

## Setup

```bash
npm run bootstrap
```

Manual frontend-only dev mode:

```bash
cd frontend
cp .env.example .env.local
npm install
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
- `NEXT_PUBLIC_OPERATOR_ID` (default `demo-operator`)
- `NEXT_PUBLIC_OPERATOR_ROLE` (`viewer` | `operator` | `admin`, default `operator`)
- `NEXT_PUBLIC_USE_MOCK_API` (`false` by default, legacy compatibility flag)
- `NEXT_PUBLIC_OFFICE_THEME` (default `studio`)
- `NEXT_PUBLIC_OFFICE_BACKGROUND_IMAGE` (override Office background image asset)
- `NEXT_PUBLIC_OFFICE_DEBUG_OVERLAY_DEFAULT` (`true`/`false`, default hidden)

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

## Office View

- Route: `/office`
- Background image + portrait tokens rendered on top of the office scene
- Pathfinding-driven movement with walkable areas, obstacles, zones, and anchor points
- Debug overlay toggle for zones, walkable map, obstacles, and anchor points
- Click-to-select staff stays in sync with drawer and Staff page highlight
