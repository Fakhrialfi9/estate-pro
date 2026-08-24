#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

printf 'Soft cleaning generated development artifacts from %s\n' "$PROJECT_ROOT"

# Keep node_modules, source, configuration, Prisma migrations/schema, docs and lockfile intact.
TARGETS=(
  dist
  coverage
  logs
  .nestjs
  node_modules/.cache
)

for target in "${TARGETS[@]}"; do
  if [ -e "$target" ] || [ -L "$target" ]; then
    printf 'Removing %s\n' "$target"
    rm -rf -- "$target"
  fi
done

find . -type f -name '*.tsbuildinfo' -delete

printf '\nSoft clean completed. Dependencies and source/configuration were preserved.\n'
