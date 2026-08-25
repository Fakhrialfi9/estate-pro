#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

PASS=0
FAIL=0

pass() {
  printf '[PASS] %s\n' "$1"
  PASS=$((PASS + 1))
}

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  FAIL=$((FAIL + 1))
}

require_file() {
  local path="$1"
  if [[ -f "$path" ]]; then
    pass "required file exists: $path"
  else
    fail "required file is missing: $path"
  fi
}

require_text() {
  local path="$1"
  local pattern="$2"
  local description="$3"

  if grep -Eq "$pattern" "$path"; then
    pass "$description"
  else
    fail "$description"
  fi
}

printf 'Estate Pro security baseline\n'
printf 'Project root: %s\n\n' "$PROJECT_ROOT"

require_file "src/main.ts"
require_file "src/bootstrap.ts"
require_file "src/app.module.ts"
require_file "src/config/configuration.ts"
require_file "src/common/constants/security.constants.ts"
require_file ".gitignore"
require_file "package.json"

require_text "src/bootstrap.ts" 'ValidationPipe' 'global validation pipe is configured'
require_text "src/bootstrap.ts" 'whitelist: true' 'validation whitelist is enabled'
require_text "src/bootstrap.ts" 'forbidNonWhitelisted: true' 'unknown properties are rejected'
require_text "src/bootstrap.ts" 'forbidUnknownValues: true' 'unknown validation values are rejected'
require_text "src/bootstrap.ts" 'helmet\(' 'Helmet security middleware is installed'
require_text "src/bootstrap.ts" 'enableCors\(' 'CORS policy is configured explicitly'

require_text "src/app.module.ts" 'ThrottlerModule\.forRootAsync' 'rate limiting is configured'
require_text "src/app.module.ts" 'APP_GUARD' 'global security guard registration exists'
require_text "src/app.module.ts" 'ThrottlerGuard' 'global throttling guard is registered'

require_text "src/config/configuration.ts" 'JWT_SECRET' 'JWT secret is validated from environment'
require_text "src/config/configuration.ts" 'min\(32\)' 'secret minimum length is enforced'
require_text "src/config/configuration.ts" 'SECURITY_CSP_ENABLED' 'CSP configuration is environment controlled'
require_text "src/config/configuration.ts" 'SECURITY_HSTS_ENABLED' 'HSTS configuration is environment controlled'

require_text "src/common/constants/security.constants.ts" 'authorization' 'authorization data is included in sensitive logging paths'
require_text "src/common/constants/security.constants.ts" 'cookie' 'cookie data is included in sensitive logging paths'
require_text "src/common/constants/security.constants.ts" 'password' 'password data is included in sensitive logging paths'
require_text "src/common/constants/security.constants.ts" 'token' 'token data is included in sensitive logging paths'

require_text ".gitignore" '^\.env$' 'dotenv files are ignored'
require_text ".gitignore" '^node_modules/$' 'node_modules is ignored'
require_text ".gitignore" '^dist/$' 'build output is ignored'
require_text ".gitignore" '^coverage/$' 'coverage output is ignored'

if command -v git >/dev/null 2>&1; then
  if git check-ignore -q .env; then
    pass '.env is ignored by Git'
  else
    fail '.env is not ignored by Git'
  fi

  tracked_secrets="$(git ls-files | grep -E '(^|/)(\.env$|\.env\.(production|staging|development|test|local)$|.*\.(pem|key|p12|pfx|secret)$)' || true)"
  if [[ -z "$tracked_secrets" ]]; then
    pass 'no environment/credential artifacts are tracked'
  else
    fail "tracked environment/credential artifacts detected: $tracked_secrets"
  fi
else
  fail 'git command is required for repository secret checks'
fi

if grep -RInE "JWT_SECRET[[:space:]]*=[[:space:]]*['\"]|DATABASE_PASSWORD[[:space:]]*=[[:space:]]*['\"]|Authorization:[[:space:]]*Bearer[[:space:]]+[A-Za-z0-9._-]{20,}" src --include='*.ts' >/dev/null 2>&1; then
  fail 'possible hardcoded secret/credential assignment detected under src/'
else
  pass 'no obvious hardcoded secret/credential assignment detected under src/'
fi

printf '\nSummary: %d passed, %d failed\n' "$PASS" "$FAIL"

if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi

printf 'SECURITY BASELINE PASSED.\n'
