#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

fail() {
  printf 'Architecture check failed: %s\n' "$1" >&2
  exit 1
}

printf 'Checking architecture boundaries in %s\n' "$PROJECT_ROOT"

[ -f scripts/check-architecture-graph.mjs ] || fail 'architecture graph checker is missing'
node scripts/check-architecture-graph.mjs || fail 'dependency graph validation failed'

[ -f scripts/check-security-boundaries.mjs ] || fail 'security boundary checker is missing'
node scripts/check-security-boundaries.mjs || fail 'security/identity boundary validation failed'

if grep -RIn --include='*.ts' 'forwardRef[[:space:]]*(' src >/dev/null 2>&1; then
  fail 'forwardRef() detected; review module graph instead of masking a cycle'
fi

if grep -REn --include='*.ts' "@prisma/|@nestjs/|mariadb|typeorm|pino|@opentelemetry/" src/modules/*/domain >/dev/null 2>&1; then
  fail 'domain layer imports infrastructure/framework dependencies'
fi

if grep -REn --include='*.ts' "modules/(auth|content|crm|health|permissions|property|roles|sales|services|system|users)|\.\./.*modules/" src/common >/dev/null 2>&1; then
  fail 'common layer imports a business module'
fi

# Infrastructure is a valid persistence boundary both at src/infrastructure/* and
# inside a feature module at src/modules/*/infrastructure/*. Keep all other source
# layers free of Prisma references.
if find src -type f -name '*.ts' ! -path '*/infrastructure/*' -print0 \
  | xargs -0 -r grep -En "@prisma/client|PrismaClient|PrismaService" >/dev/null 2>&1; then
  fail 'Prisma reference detected outside infrastructure; keep database access behind infrastructure abstractions'
fi

if grep -REn --include='*.ts' "@prisma/client|PrismaClient|PrismaService|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b" src/modules/*/presentation src --include='*controller.ts' >/dev/null 2>&1; then
  fail 'presentation layer contains persistence implementation details'
fi

if grep -REn --include='*.ts' "@prisma/client|PrismaClient|PrismaService" src/modules/*/application >/dev/null 2>&1; then
  fail 'application layer directly references Prisma'
fi

printf 'Architecture boundary checks passed.\n'
