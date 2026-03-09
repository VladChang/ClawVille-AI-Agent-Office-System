#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.clawville"
RUN_DIR="$STATE_DIR/run"
LOG_DIR="$STATE_DIR/logs"
MODE_FILE="$STATE_DIR/runtime-mode"

MODE="auto"
NO_BUILD="false"

print_help() {
  cat <<'EOF'
Usage: bash scripts/bootstrap.sh [--mode docker|local] [--no-build]

Defaults to Docker if a working Docker Compose environment is available.
Falls back to local Node deployment otherwise.

Examples:
  bash scripts/bootstrap.sh
  bash scripts/bootstrap.sh --mode docker
  bash scripts/bootstrap.sh --mode local
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --docker)
      MODE="docker"
      shift
      ;;
    --local)
      MODE="local"
      shift
      ;;
    --no-build)
      NO_BUILD="true"
      shift
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      print_help >&2
      exit 1
      ;;
  esac
done

mkdir -p "$RUN_DIR" "$LOG_DIR"

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

detect_compose() {
  if has_cmd docker && docker compose version >/dev/null 2>&1; then
    return 0
  fi

  if has_cmd docker-compose; then
    return 0
  fi

  return 1
}

compose_run() {
  if has_cmd docker && docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi

  if has_cmd docker-compose; then
    docker-compose "$@"
    return
  fi

  echo "Docker Compose is not available." >&2
  return 1
}

docker_ready() {
  has_cmd docker && docker info >/dev/null 2>&1 && detect_compose
}

ensure_file_from_example() {
  local target="$1"
  local example="$2"

  if [[ -f "$target" ]]; then
    return
  fi

  cp "$example" "$target"
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local pid_file="${3:-}"
  local log_file="${4:-}"
  local attempts=60

  if has_cmd curl; then
    for ((i = 0; i < attempts; i += 1)); do
      if curl -fsS "$url" >/dev/null 2>&1; then
        echo "$label is ready at $url"
        return 0
      fi
      if [[ -n "$pid_file" && -f "$pid_file" ]] && ! kill -0 "$(cat "$pid_file")" >/dev/null 2>&1; then
        echo "$label exited before becoming healthy." >&2
        if [[ -n "$log_file" && -f "$log_file" ]]; then
          tail -n 40 "$log_file" >&2 || true
        fi
        return 1
      fi
      sleep 1
    done
  elif has_cmd wget; then
    for ((i = 0; i < attempts; i += 1)); do
      if wget -qO- "$url" >/dev/null 2>&1; then
        echo "$label is ready at $url"
        return 0
      fi
      if [[ -n "$pid_file" && -f "$pid_file" ]] && ! kill -0 "$(cat "$pid_file")" >/dev/null 2>&1; then
        echo "$label exited before becoming healthy." >&2
        if [[ -n "$log_file" && -f "$log_file" ]]; then
          tail -n 40 "$log_file" >&2 || true
        fi
        return 1
      fi
      sleep 1
    done
  else
    echo "Skipping health check for $label because neither curl nor wget is available."
    return 0
  fi

  echo "Timed out waiting for $label at $url" >&2
  return 1
}

ensure_node_tooling() {
  if ! has_cmd node || ! has_cmd npm; then
    echo "Local mode requires both node and npm." >&2
    exit 1
  fi
}

ensure_package_install() {
  local service_dir="$1"

  if [[ -d "$service_dir/node_modules" ]]; then
    return
  fi

  (cd "$service_dir" && npm ci)
}

stop_local_if_running() {
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
    fi
    rm -f "$pid_file"
  done
}

start_local_service() {
  local service_dir="$1"
  local env_file="$2"
  local log_file="$3"
  local pid_file="$4"
  shift 4

  (
    cd "$service_dir"
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
    nohup "$@" >"$log_file" 2>&1 &
    echo $! >"$pid_file"
  )
}

bootstrap_local() {
  ensure_node_tooling
  ensure_file_from_example "$ROOT_DIR/backend/.env" "$ROOT_DIR/backend/.env.example"
  ensure_file_from_example "$ROOT_DIR/backend/.env.adapter" "$ROOT_DIR/backend/.env.adapter.example"
  ensure_file_from_example "$ROOT_DIR/frontend/.env.local" "$ROOT_DIR/frontend/.env.example"

  stop_local_if_running

  ensure_package_install "$ROOT_DIR/backend"
  ensure_package_install "$ROOT_DIR/frontend"

  if [[ "$NO_BUILD" != "true" ]]; then
    (cd "$ROOT_DIR/backend" && npm run build)
    (cd "$ROOT_DIR/frontend" && npm run build)
  fi

  start_local_service \
    "$ROOT_DIR/backend" \
    "$ROOT_DIR/backend/.env.adapter" \
    "$LOG_DIR/adapter.log" \
    "$RUN_DIR/adapter.pid" \
    npm run adapter:start
  wait_for_http \
    "http://127.0.0.1:3010/health" \
    "OpenClaw adapter" \
    "$RUN_DIR/adapter.pid" \
    "$LOG_DIR/adapter.log"

  start_local_service \
    "$ROOT_DIR/backend" \
    "$ROOT_DIR/backend/.env" \
    "$LOG_DIR/backend.log" \
    "$RUN_DIR/backend.pid" \
    npm start
  wait_for_http \
    "http://127.0.0.1:3001/api/health" \
    "Backend" \
    "$RUN_DIR/backend.pid" \
    "$LOG_DIR/backend.log"

  start_local_service \
    "$ROOT_DIR/frontend" \
    "$ROOT_DIR/frontend/.env.local" \
    "$LOG_DIR/frontend.log" \
    "$RUN_DIR/frontend.pid" \
    npm start
  wait_for_http \
    "http://127.0.0.1:3000" \
    "Frontend" \
    "$RUN_DIR/frontend.pid" \
    "$LOG_DIR/frontend.log"

  echo "local" >"$MODE_FILE"
  echo "ClawVille is running in local mode."
  echo "Frontend: http://localhost:3000"
  echo "Backend:  http://localhost:3001/api/health"
  echo "Adapter:  http://localhost:3010/health"
  echo "Logs:     $LOG_DIR"
  echo "Stop:     bash scripts/stop.sh"
}

bootstrap_docker() {
  if ! docker_ready; then
    echo "Docker mode requested, but Docker Compose is not ready on this machine." >&2
    exit 1
  fi

  ensure_file_from_example "$ROOT_DIR/.env" "$ROOT_DIR/.env.example"

  (
    cd "$ROOT_DIR"
    if [[ "$NO_BUILD" == "true" ]]; then
      compose_run up -d
    else
      compose_run up --build -d
    fi
  )

  wait_for_http "http://127.0.0.1:3001/api/health" "Backend"
  wait_for_http "http://127.0.0.1:3000" "Frontend"

  echo "docker" >"$MODE_FILE"
  echo "ClawVille is running in docker mode."
  echo "Frontend: http://localhost:3000"
  echo "Backend:  http://localhost:3001/api/health"
  echo "Stop:     bash scripts/stop.sh"
}

case "$MODE" in
  auto)
    if docker_ready; then
      bootstrap_docker
    else
      bootstrap_local
    fi
    ;;
  docker)
    bootstrap_docker
    ;;
  local)
    bootstrap_local
    ;;
  *)
    echo "Invalid mode: $MODE" >&2
    exit 1
    ;;
esac
