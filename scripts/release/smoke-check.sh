#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

: "${FRONTEND_BASE_URL:=http://localhost:3000}"
: "${API_BASE_URL:=http://localhost:3001/api}"

echo "[smoke] frontend=${FRONTEND_BASE_URL} api=${API_BASE_URL}"

echo "[smoke] running acceptance smoke with /ready + /metrics checks"
(
  cd "$FRONTEND_DIR"
  FRONTEND_BASE_URL="$FRONTEND_BASE_URL" \
  API_BASE_URL="$API_BASE_URL" \
  ACCEPTANCE_CHECK_READY=true \
  ACCEPTANCE_READY_MODE=graceful \
  ACCEPTANCE_CHECK_METRICS=true \
  npm run acceptance:e2e
)

echo "[smoke] OK"
