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

# A cycle must be fixed at the dependency level, not hidden with forwardRef().
if grep -RIn --include='*.ts' 'forwardRef[[:space:]]*(' src >/dev/null 2>&1; then
  fail 'forwardRef() detected; review module graph instead of masking a cycle'
fi

# Domain must not know framework, persistence, or operational infrastructure.
if grep -REn --include='*.ts' "@prisma/|@nestjs/|mariadb|typeorm|pino|@opentelemetry/" src/modules/*/domain >/dev/null 2>&1; then
  fail 'domain layer imports infrastructure/framework dependencies'
fi

# Common must stay generic and must not import business modules.
if grep -REn --include='*.ts' "modules/(auth|content|crm|health|permissions|property|roles|sales|services|system|users)|\.\./.*modules/" src/common >/dev/null 2>&1; then
  fail 'common layer imports a business module'
fi

# Prisma is an infrastructure concern. No source outside the infrastructure database boundary may import it.
if grep -REn --include='*.ts' "@prisma/client|PrismaClient|PrismaService" src --exclude-dir=infrastructure >/dev/null 2>&1; then
  fail 'Prisma reference detected outside infrastructure; keep database access behind infrastructure abstractions'
fi

# Presentation must not contain persistence implementation details or SQL.
if grep -REn --include='*.ts' "@prisma/client|PrismaClient|PrismaService|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b" src/modules/*/presentation src --include='*controller.ts' >/dev/null 2>&1; then
  fail 'presentation layer contains persistence implementation details'
fi

# Application must not access Prisma directly.
if grep -REn --include='*.ts' "@prisma/client|PrismaClient|PrismaService" src/modules/*/application >/dev/null 2>&1; then
  fail 'application layer directly references Prisma'
fi

printf 'Architecture boundary checks passed.\n'
