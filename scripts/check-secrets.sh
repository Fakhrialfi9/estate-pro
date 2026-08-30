#!/usr/bin/env bash

set -euo pipefail

# Scan tracked source/config artifacts for common high-risk secret patterns.
# Example env files contain placeholders and are intentionally excluded.
tracked_files=$(git ls-files | grep -Ev '(^|/)(\.env|\.env\.[^/]+|package-lock\.json)$' || true)

if [ -z "$tracked_files" ]; then
  exit 0
fi

patterns=(
  'BEGIN (RSA|EC|OPENSSH|DSA|PRIVATE) PRIVATE KEY'
  'AKIA[0-9A-Z]{16}'
  'gh[pousr]_[A-Za-z0-9_]{20,}'
  'sk-[A-Za-z0-9]{20,}'
  '-----BEGIN PRIVATE KEY-----'
)

for pattern in "${patterns[@]}"; do
  if printf '%s\n' "$tracked_files" | xargs -r grep -nHE "$pattern" -- 2>/dev/null; then
    printf 'Potential secret detected by pattern: %s\n' "$pattern" >&2
    exit 1
  fi
done

# Authentication secrets must never be hardcoded in application source.
if printf '%s\n' "$tracked_files" | xargs -r grep -nHE 'JWT_SECRET[[:space:]]*=[[:space:]]*[A-Za-z0-9+/=_-]{32,}' -- 2>/dev/null; then
  printf 'Potential hardcoded JWT secret detected.\n' >&2
  exit 1
fi

printf 'Secret scan passed.\n'
