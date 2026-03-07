# Sprint 4 Release Checklist (Lightweight)

Use this checklist before tagging/releasing Sprint 4.

## 1) Pre-flight

- [ ] `main` (or release branch) is up to date and CI is green.
- [ ] Backend and frontend env files exist (`backend/.env`, `frontend/.env.local`).
- [ ] Local dependencies installed:
  - [ ] `cd backend && npm install`
  - [ ] `cd frontend && npm install`

## 2) Build + static checks

- [ ] Backend type/build check passes:
  - [ ] `cd backend && npm run check && npm run build`
- [ ] Frontend lint/build check passes:
  - [ ] `cd frontend && npm run lint && npm run build`

## 3) Runtime smoke (manual)

- [ ] Start backend: `cd backend && npm run dev`
- [ ] Start frontend: `cd frontend && npm run dev`
- [ ] Verify pages load (HTTP 200 + visible UI):
  - [ ] `/`
  - [ ] `/agents`
  - [ ] `/tasks`
  - [ ] `/events`
  - [ ] `/office`
  - [ ] `/analytics`

## 4) API + realtime sanity

- [ ] `GET /api/health` returns `success: true` and `data.ok: true`
- [ ] `GET /api/overview`, `/api/agents`, `/api/tasks`, `/api/events?limit=5` return 200
- [ ] WebSocket endpoint `ws://localhost:3001/ws` emits snapshot/event messages

## 5) Sprint 4 feature acceptance

- [ ] Office view still renders room map and selectable avatars (`/office`)
- [ ] Analytics view renders derived metric cards (`/analytics`)
- [ ] Analytics incident playback controls work (Prev/Play/Next/Reset)
- [ ] No blocking console/runtime errors on core routes

## 6) Scripted acceptance (optional but recommended)

With backend (`:3001`) and frontend (`:3000`) already running:

```bash
cd frontend
npm run acceptance:e2e
```

- [ ] Script completes with `All smoke checks passed.`

## 7) Release readiness sign-off

- [ ] Release notes updated
- [ ] Known issues documented (if any)
- [ ] Final QA sign-off from Sprint owner
