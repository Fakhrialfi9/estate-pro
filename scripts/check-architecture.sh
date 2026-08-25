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

if git grep -nE -- '*.ts' 'forwardRef[[:space:]]*\(' -- ':!**/node_modules/**' >/dev/null 2>&1; then
  fail 'forwardRef() detected; review module graph instead of masking a cycle'
fi

if git grep -nE -- '*.ts' '@prisma/|@nestjs/|mariadb|typeorm|pino|@opentelemetry/' -- 'src/modules/*/domain/**' >/dev/null 2>&1; then
  fail 'domain layer imports infrastructure/framework dependencies'
fi

if git grep -nE -- '*.ts' 'modules/(auth|content|crm|health|permissions|property|roles|sales|services|system|users)|\.\./.*modules/' -- 'src/common/**' >/dev/null 2>&1; then
  fail 'common layer imports a business module'
fi

# Prisma is allowed only inside infrastructure boundaries.
if git grep -nE -- '*.ts' '@prisma/client|PrismaClient|PrismaService' -- \
  ':(exclude)src/infrastructure/**' \
  ':(exclude)src/modules/*/infrastructure/**' \
  'src/**' >/dev/null 2>&1; then
  fail 'Prisma reference detected outside infrastructure; keep database access behind infrastructure abstractions'
fi

if git grep -nE -- '*.ts' '@prisma/client|PrismaClient|PrismaService|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b' -- \
  'src/modules/*/presentation/**' \
  'src/**/controller.ts' >/dev/null 2>&1; then
  fail 'presentation layer contains persistence implementation details'
fi

if git grep -nE -- '*.ts' '@prisma/client|PrismaClient|PrismaService' -- 'src/modules/*/application/**' >/dev/null 2>&1; then
  fail 'application layer directly references Prisma'
fi

printf 'Architecture boundary checks passed.\n'
