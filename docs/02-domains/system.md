# System Domain

The `system` context is the operational boundary for cross-cutting capabilities. Authentication/authorization remain owned by their dedicated modules; database access remains infrastructure-owned.

## Implemented foundations

- typed global Settings registry with optimistic versioning;
- System Activity read model with centralized redaction;
- existing immutable Audit module reused rather than duplicated;
- existing Automation workflow execution exposed as System Job operations;
- existing Automation Notification persistence exposed through a user-scoped System API;
- existing Health module retained as liveness/readiness owner;
- existing logging/telemetry infrastructure retained as observability owner.

The remaining import/export and outbound integration capabilities require provider/domain-specific contracts before implementation; the repository must not invent arbitrary business import mappings or external provider behavior.
