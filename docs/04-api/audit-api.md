# Audit API

Base path `/api/v1/system/audit-logs`.

`GET /system/audit-logs` requires `audit:read` and supports the controller's paginated filters (`actorUuid`, `action`, `resourceType`, `resourceId`, `result`, `from`, `to`). Invalid date ranges return `400`.

Audit records are read-only through this API. A successful audit query records `AUDIT_LOG_ACCESSED`, preserving the audit trail for audit-trail access itself.
