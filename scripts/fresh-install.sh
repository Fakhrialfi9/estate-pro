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
require_command npm
require_command bash

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" != "22" ]; then
  printf 'Node.js 22.x is required; detected %s.\n' "$(node --version)" >&2
  exit 1
fi

NPM_VERSION="$(npm --version)"
case "$NPM_VERSION" in
  11.*) ;;
  *) printf 'npm 11.x is required by package.json; detected %s.\n' "$NPM_VERSION" >&2; exit 1 ;;
esac

[ -f package.json ] || { printf 'package.json not found.\n' >&2; exit 1; }
[ -f package-lock.json ] || { printf 'package-lock.json is required for a reproducible fresh install.\n' >&2; exit 1; }

printf 'Starting Estate Pro fresh install in %s\n' "$PROJECT_ROOT"

# Only generated/development artifacts are removed. Source, config, docs and lockfile remain untouched.
rm -rf -- dist coverage .nestjs
find . -type f -name '*.tsbuildinfo' -delete
rm -rf -- node_modules

printf 'Installing dependencies from package-lock.json...\n'
npm ci

if [ -d prisma ]; then
  printf 'Generating Prisma client...\n'
  npm run prisma:generate
fi

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp -- .env.example .env
    printf 'Created .env from .env.example. Replace placeholders before starting the application.\n'
  else
    printf 'Warning: .env.example is not present; create .env manually.\n' >&2
  fi
fi

printf '\nFresh install completed.\n'
printf 'Next: configure .env, then run npm run start:dev.\n'
