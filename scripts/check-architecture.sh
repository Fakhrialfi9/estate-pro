#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

fail() {
  printf 'Architecture check failed: %s\n' "$1" >&2
  exit 1
}

printf 'Checking architecture boundaries in %s\n' "$PROJECT_ROOT"

# Domain must not know framework, persistence, or operational infrastructure.
if find src/modules -type d -path '*/domain' -print0 | xargs -0 -r grep -REn --include='*.ts' "@prisma/|@nestjs/|mariadb|typeorm|pino|@opentelemetry/" >/dev/null; then
  fail 'domain layer imports infrastructure/framework dependencies'
fi

# Common must stay generic and must not import business modules.
if find src/common -type f -name '*.ts' -print0 | xargs -0 -r grep -REn "modules/(auth|content|crm|health|permissions|property|roles|sales|services|system|users)|\.\./.*modules/" >/dev/null; then
  fail 'common layer imports a business module'
fi

# Prisma is an infrastructure concern.
if find src/modules -type f -name '*.ts' -print0 | xargs -0 -r grep -REn "@prisma/client|PrismaClient|PrismaService" >/dev/null; then
  fail 'business modules directly reference Prisma'
fi

# Presentation must not access Prisma directly.
if find src -type f \( -name '*controller.ts' -o -path '*/presentation/*.ts' \) -print0 | xargs -0 -r grep -REn "@prisma/client|PrismaClient|PrismaService" >/dev/null; then
  fail 'presentation layer directly references Prisma'
fi

# Application must not access Prisma directly.
if find src/modules -type d -path '*/application' -print0 | xargs -0 -r grep -REn --include='*.ts' "@prisma/client|PrismaClient|PrismaService" >/dev/null; then
  fail 'application layer directly references Prisma'
fi

# A cycle must be fixed at the dependency level, not hidden with forwardRef().
if grep -RIn --include='*.ts' 'forwardRef[[:space:]]*(' src >/dev/null; then
  fail 'forwardRef() detected; review module graph instead of masking a cycle'
fi

printf 'Architecture boundary checks passed.\n'
