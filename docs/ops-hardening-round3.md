# Round 3 — Deployment & Ops Hardening Baseline

This document captures the non-cloud-locked deployment path and baseline operational/security controls introduced in Round 3.

## 1) Dockerized local/prod-like deployment

Root compose file: `docker-compose.yml`

Services:
- `backend` (Fastify, port `3001`)
- `frontend` (Next.js, port `3000`)

Run:

```bash
docker compose build
docker compose up -d
```

Validate:

```bash
curl -fsS http://localhost:3001/api/health
curl -fsS http://localhost:3001/api/ready
curl -fsS http://localhost:3001/api/metrics
curl -fsS http://localhost:3000
```

Stop:

```bash
docker compose down
```

## 2) Health and readiness semantics

- `GET /api/health`
  - Liveness check only (process up)
  - Always returns `success=true` if service loop is active

- `GET /api/ready`
  - Readiness posture check
  - Returns `503 NOT_READY` when backend is in strict `openclaw` degraded mode (`RUNTIME_SOURCE=openclaw` with fallback disabled and runtime not configured)
  - Returns `200` in normal mock mode and permissive fallback mode

## 3) Baseline observability

### Structured logs

Backend logs are structured JSON via Fastify logger.

### Request IDs

- Incoming `x-request-id` is honored
- If missing, backend generates UUID request IDs
- Response includes `x-request-id` for correlation

### Metrics endpoint

`GET /api/metrics` (Prometheus text format) exposes lightweight in-memory metrics:

- `clawville_process_uptime_seconds`
- `clawville_http_requests_total`
- `clawville_http_request_duration_ms_sum`
- `clawville_http_requests_by_route_total{method,route,status_code}`

## 4) Security baseline checks

### Environment requirements

Backend:
- `RUNTIME_SOURCE=mock|openclaw`
- `ALLOW_RUNTIME_FALLBACK=false` for production-like posture
- `OPENCLAW_RUNTIME_ENDPOINT` + `OPENCLAW_RUNTIME_API_KEY` required for true OpenClaw mode
- `CORS_ORIGIN` must be explicit in production

Frontend:
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_WS_URL`
- `NEXT_PUBLIC_RUNTIME_MODE=real` for strict production-like behavior

### CORS guidance

- Development can temporarily use permissive CORS
- Production should use a specific trusted origin, e.g. `https://dashboard.example.com`

### Secret handling

- Do **not** commit `.env` files with real secrets
- Use environment injection in CI/CD and runtime platform
- Rotate compromised API keys immediately

## 5) CI compatibility

Round 3 changes are designed to keep existing CI green:
- Backend typecheck/tests/build unchanged in pipeline
- Frontend tests/build unchanged in pipeline
- Compose definition is static-validated with `docker compose config` (when Docker CLI is available)
