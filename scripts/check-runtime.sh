#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  }
}

require_command node
require_command curl

PORT="${RUNTIME_CHECK_PORT:-3100}"
LOG_FILE="${RUNTIME_CHECK_LOG_FILE:-$(mktemp -t estate-pro-runtime.XXXXXX.log)}"
PID=""

cleanup() {
  if [ -n "$PID" ] && kill -0 "$PID" >/dev/null 2>&1; then
    kill "$PID" >/dev/null 2>&1 || true
    wait "$PID" 2>/dev/null || true
  fi
  rm -f -- "$LOG_FILE"
}
trap cleanup EXIT INT TERM

APP_NAME="estate-pro-runtime-check" \
APP_VERSION="0.0.1" \
NODE_ENV="test" \
APP_HOST="127.0.0.1" \
APP_PORT="$PORT" \
API_PREFIX="api" \
API_VERSION="v1" \
DATABASE_URL="mysql://test:test@127.0.0.1:3306/estate_pro_test" \
DATABASE_HOST="127.0.0.1" \
DATABASE_PORT="3306" \
DATABASE_NAME="estate_pro_test" \
DATABASE_USER="test" \
DATABASE_PASSWORD="test-password" \
JWT_SECRET="test-only-secret-that-is-at-least-32-chars" \
SECURITY_CORS_ORIGINS="http://localhost:3000" \
OTEL_TRACING_ENABLED="false" \
OTEL_METRICS_ENABLED="false" \
LOG_LEVEL="silent" \
node dist/src/main.js >"$LOG_FILE" 2>&1 &
PID=$!

for _ in $(seq 1 30); do
  if curl --silent --show-error --fail "http://127.0.0.1:${PORT}/api/v1/health/live" >/dev/null; then
    printf 'Compiled runtime check passed on http://127.0.0.1:%s\n' "$PORT"
    exit 0
  fi

  if ! kill -0 "$PID" >/dev/null 2>&1; then
    printf 'Compiled application exited before becoming ready.\n' >&2
    cat "$LOG_FILE" >&2
    exit 1
  fi

  sleep 1
done

printf 'Compiled application did not become ready within 30 seconds.\n' >&2
cat "$LOG_FILE" >&2
exit 1
