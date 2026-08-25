# Authorization Security Boundary

Estate Pro authorization is server-side, fail-closed, and based on the authenticated principal's authoritative database state.

## Resolution chain

`Authenticated principal -> User -> active UserRole -> active Role -> RolePermission -> Permission`

JWT validation establishes identity only. Permission and role claims supplied in a token are not used as the authorization source of truth; the authorization resolver hydrates the current state from the database for every protected evaluation.

## Policies

- `RequirePermissions(...)` means AND semantics: every declared permission is required.
- `RequirePermissionsAny(...)` means OR semantics: at least one declared permission is required.
- `RequireRoles(...)` means AND semantics for roles.
- `RequireRolesAny(...)` means OR semantics for roles.
- `Public()` is the only explicit authorization bypass supported by the authorization guard.
- Missing or invalid authorization metadata is denied.
- Authorization resolution failure is denied.

## HTTP contract

A missing or invalid authenticated principal is `401 Unauthorized`.
A valid principal that fails authorization is `403 Forbidden`.

## Ownership and privilege

Resource ownership remains an application policy. The authenticated principal is the owner identity; request body/query identifiers never establish ownership. Role and permission mutations remain protected by the existing role/permission domain policies and security audit events.

## Cache policy

Authorization currently resolves directly from the authoritative database and does not introduce a permission cache. Cache invalidation is therefore not applicable. This avoids stale privilege and cross-user cache leakage rather than adding cache infrastructure solely for authorization.
