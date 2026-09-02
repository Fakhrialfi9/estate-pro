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
DATABASE_URL="mysql://test:test-password@127.0.0.1:3306/estate_pro_test" \
JWT_SECRET="test-only-secret-that-is-at-least-32-chars" \
SECURITY_CORS_ORIGINS="http://localhost:3000" \
SWAGGER_ENABLED="true" \
OTEL_TRACING_ENABLED="false" \
OTEL_METRICS_ENABLED="false" \
LOG_LEVEL="silent" \
node dist/src/main.js >"$LOG_FILE" 2>&1 &
PID=$!

base_url="http://127.0.0.1:${PORT}/api/v1/health"

for _ in $(seq 1 30); do
  live_status="$(curl --silent --output /dev/null --write-out '%{http_code}' "$base_url/live" || true)"
  ready_status="$(curl --silent --output /dev/null --write-out '%{http_code}' "$base_url/ready" || true)"

  if [ "$live_status" = "200" ] && [ "$ready_status" = "200" ]; then
    printf 'Compiled runtime liveness/readiness checks passed on http://127.0.0.1:%s\n' "$PORT"
    node scripts/validate-openapi.mjs "http://127.0.0.1:${PORT}/docs-json"
    printf 'Compiled runtime OpenAPI contract validation passed.\n'
    exit 0
  fi

  if ! kill -0 "$PID" >/dev/null 2>&1; then
    printf 'Compiled application exited before becoming ready.\n' >&2
    cat "$LOG_FILE" >&2
    exit 1
  fi

  sleep 1
done

printf 'Compiled application did not pass liveness/readiness within 30 seconds.\n' >&2
printf 'Liveness HTTP status: %s\n' "$live_status" >&2
printf 'Readiness HTTP status: %s\n' "$ready_status" >&2
cat "$LOG_FILE" >&2
exit 1
