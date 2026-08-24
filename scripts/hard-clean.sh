#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

printf 'Hard cleaning generated/development artifacts from %s\n' "$PROJECT_ROOT"

# Explicit whitelist. Never delete source, configuration, documentation, migrations, .git, or lockfiles.
TARGETS=(
  dist
  coverage
  .nestjs
  logs
  node_modules/.cache
  node_modules
)

for target in "${TARGETS[@]}"; do
  if [ -e "$target" ] || [ -L "$target" ]; then
    printf 'Removing %s\n' "$target"
    rm -rf -- "$target"
  fi
done

find . -type f -name '*.tsbuildinfo' -delete

printf '\nHard clean completed.\n'
printf 'package-lock.json was intentionally preserved. Run npm ci to reinstall dependencies.\n'
