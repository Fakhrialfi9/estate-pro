#!/usr/bin/env bash

set -euo pipefail

echo "=========================================="
echo " EstatePro Architecture Setup"
echo "=========================================="

# ============================================================
# DIRECTORIES
# ============================================================

mkdir -p \
  src/config \
  src/common/{constants,decorators,dto,enums,exceptions,filters,guards,interceptors,middleware,pipes,serializers,types,utils} \
  src/infrastructure/database/prisma \
  src/infrastructure/logging \
  src/infrastructure/observability \
  src/modules/{auth,users,roles,permissions} \
  src/modules/property/{application/{dto,services,use-cases},domain/{entities,repositories,value-objects,services},infrastructure/{persistence/{prisma,repositories},mappers},presentation/{controllers,serializers}} \
  src/modules/sales/{application,domain,infrastructure,presentation} \
  src/modules/services/{application,domain,infrastructure,presentation} \
  src/modules/content/{application,domain,infrastructure,presentation} \
  src/modules/crm/{application,domain,infrastructure,presentation} \
  src/modules/system/{application,domain,infrastructure,presentation} \
  src/health \
  test/{unit,integration,e2e,security,health,observability} \
  prisma/{generated,migrations,seeds} \
  prisma/schema/{property,sales,services,content,crm,users,system}

# ============================================================
# CONFIG
# ============================================================

touch \
  src/config/app.config.ts \
  src/config/database.config.ts \
  src/config/auth.config.ts \
  src/config/cors.config.ts \
  src/config/security.config.ts \
  src/config/rate-limit.config.ts \
  src/config/logging.config.ts \
  src/config/observability.config.ts \
  src/config/configuration.ts

# ============================================================
# DATABASE
# ============================================================

touch \
  src/infrastructure/database/database.module.ts \
  src/infrastructure/database/prisma/prisma.module.ts \
  src/infrastructure/database/prisma/prisma.service.ts

# ============================================================
# LOGGING
# ============================================================

touch \
  src/infrastructure/logging/logger.module.ts \
  src/infrastructure/logging/logger.config.ts

# ============================================================
# OBSERVABILITY
# ============================================================

touch \
  src/infrastructure/observability/telemetry.ts \
  src/infrastructure/observability/observability.module.ts

# ============================================================
# MODULES
# ============================================================

touch \
  src/modules/auth/auth.module.ts \
  src/modules/users/users.module.ts \
  src/modules/roles/roles.module.ts \
  src/modules/permissions/permissions.module.ts \
  src/modules/property/property.module.ts \
  src/modules/sales/sales.module.ts \
  src/modules/services/services.module.ts \
  src/modules/content/content.module.ts \
  src/modules/crm/crm.module.ts \
  src/modules/system/system.module.ts

# ============================================================
# HEALTH
# ============================================================

touch \
  src/health/health.controller.ts \
  src/health/health.module.ts \
  src/health/health.service.ts

# ============================================================
# GITKEEP
# ============================================================

find src/common -type d -empty -exec touch {}/.gitkeep \;
find src/modules -type d -empty -exec touch {}/.gitkeep \;
find test -type d -empty -exec touch {}/.gitkeep \;

echo
echo "Architecture directories and files created."
echo "Existing files were not overwritten."
echo

# ============================================================
# TREE
# ============================================================

if command -v tree >/dev/null 2>&1; then
  tree -I 'node_modules|.git'
else
  echo "Install 'tree' to inspect the complete structure."
fi