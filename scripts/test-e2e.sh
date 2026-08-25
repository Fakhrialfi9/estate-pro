#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_FILE="docker-compose.e2e.yml"
COMPOSE_PROJECT="estate-pro-e2e"
E2E_DB_PORT="${E2E_DB_PORT:-3307}"

cleanup() {
  if [[ "${CI:-false}" != "true" && -n "${DOCKER_E2E_STARTED:-}" ]]; then
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" down --volumes --remove-orphans >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

if [[ "${CI:-false}" != "true" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "E2E requires Docker for the isolated MariaDB test environment." >&2
    exit 1
  fi

  if ! docker compose version >/dev/null 2>&1; then
    echo "E2E requires Docker Compose v2 (docker compose)." >&2
    exit 1
  fi

  export DATABASE_URL="mysql://test:test-password@127.0.0.1:${E2E_DB_PORT}/estate_pro_test"
  export DATABASE_HOST="127.0.0.1"
  export DATABASE_PORT="$E2E_DB_PORT"
  export DATABASE_NAME="estate_pro_test"
  export DATABASE_USER="test"
  export DATABASE_PASSWORD="test-password"
  export DATABASE_POOL_CONNECTION_LIMIT="2"
  export DATABASE_CONNECT_TIMEOUT_MS="5000"
  export DATABASE_ACQUIRE_TIMEOUT_MS="10000"
  export DATABASE_POOL_IDLE_TIMEOUT_SEC="30"

  export DOCKER_E2E_STARTED=1
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" up -d mariadb

  echo "Waiting for isolated MariaDB E2E service..."
  for _ in {1..60}; do
    container_id="$(docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" ps -q mariadb 2>/dev/null || true)"
    if [[ -n "$container_id" ]]; then
      health="$(docker inspect --format '{{.State.Health.Status}}' "$container_id" 2>/dev/null || true)"
      if [[ "$health" == "healthy" ]]; then
        break
      fi
    fi
    sleep 1
  done

  container_id="$(docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" ps -q mariadb 2>/dev/null || true)"
  health="$(docker inspect --format '{{.State.Health.Status}}' "$container_id" 2>/dev/null || true)"
  if [[ "$health" != "healthy" ]]; then
    echo "MariaDB E2E service did not become healthy." >&2
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" logs mariadb >&2 || true
    exit 1
  fi

  npx prisma migrate deploy
fi

exec npx vitest run --config vitest.e2e.config.ts "$@"
