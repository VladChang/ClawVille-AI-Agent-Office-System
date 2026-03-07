#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TAG="${1:-}"
DRY_RUN="${2:-}"

if [[ -z "$TAG" ]]; then
  echo "Usage: scripts/release/tagged-release.sh <tag> [--dry-run]"
  echo "Example: scripts/release/tagged-release.sh v0.4.0 --dry-run"
  exit 1
fi

if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Tag must match semantic version format: v<major>.<minor>.<patch>"
  exit 1
fi

cd "$ROOT_DIR"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit/stash changes before release."
  exit 1
fi

echo "==> Preflight: backend check + build"
(
  cd backend
  npm ci
  npm run check
  npm run build
)

echo "==> Preflight: frontend test + build"
(
  cd frontend
  npm ci
  npm run test
  NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api \
  NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws \
  NEXT_PUBLIC_USE_MOCK_API=false \
  npm run build
)

echo "==> Preflight: acceptance smoke (/ready + /metrics enabled)"
BACKEND_PID=""
FRONTEND_PID=""
cleanup() {
  if [[ -n "$FRONTEND_PID" ]]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
  if [[ -n "$BACKEND_PID" ]]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

(
  cd backend
  PORT=3001 HOST=127.0.0.1 npm start > ../backend.release.log 2>&1
) &
BACKEND_PID=$!

(
  cd frontend
  PORT=3000 \
  NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api \
  NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws \
  NEXT_PUBLIC_USE_MOCK_API=false \
  npm start > ../frontend.release.log 2>&1
) &
FRONTEND_PID=$!

for i in {1..60}; do
  if curl -fsS "http://127.0.0.1:3001/api/health" >/dev/null; then break; fi
  sleep 1
done
for i in {1..60}; do
  if curl -fsS "http://127.0.0.1:3000" >/dev/null; then break; fi
  sleep 1
done

(
  cd frontend
  FRONTEND_BASE_URL=http://127.0.0.1:3000 \
  API_BASE_URL=http://127.0.0.1:3001/api \
  ACCEPTANCE_CHECK_READY=true \
  ACCEPTANCE_READY_MODE=graceful \
  ACCEPTANCE_CHECK_METRICS=true \
  npm run acceptance:e2e
)

echo "==> Preflight checks passed"

if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "Dry run complete. Skipping tag creation/push for $TAG"
  exit 0
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG already exists"
  exit 1
fi

git tag -a "$TAG" -m "Release $TAG"
git push origin "$TAG"

echo "Release tag pushed: $TAG"
