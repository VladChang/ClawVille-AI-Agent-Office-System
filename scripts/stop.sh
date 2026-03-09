#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.clawville"
RUN_DIR="$STATE_DIR/run"
MODE_FILE="$STATE_DIR/runtime-mode"

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

compose_run() {
  if has_cmd docker && docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi

  if has_cmd docker-compose; then
    docker-compose "$@"
  fi
}

stop_local() {
  local stopped="false"
  local pid_file

  for pid_file in "$RUN_DIR"/adapter.pid "$RUN_DIR"/backend.pid "$RUN_DIR"/frontend.pid; do
    if [[ ! -f "$pid_file" ]]; then
      continue
    fi

    local pid
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      wait "$pid" 2>/dev/null || true
      stopped="true"
    fi
    rm -f "$pid_file"
  done

  if [[ "$stopped" == "true" ]]; then
    echo "Stopped local ClawVille processes."
  fi
}

stop_docker() {
  if ! has_cmd docker && ! has_cmd docker-compose; then
    return
  fi

  if [[ -f "$ROOT_DIR/docker-compose.yml" ]]; then
    (
      cd "$ROOT_DIR"
      compose_run down >/dev/null 2>&1 || true
    )
  fi
}

stop_local
stop_docker
rm -f "$MODE_FILE"
echo "ClawVille stop sequence completed."
