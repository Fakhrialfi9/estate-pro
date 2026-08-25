# Permission model

Estate Pro treats permissions as atomic authorization capabilities. The canonical stable identifier is derived from structured fields using the `module.action` form.

For example:

- `users.read`
- `users.update`
- `roles.manage`

`module`, `domain`, and `action` are normalized with NFKC, trimming, and lowercase canonicalization. The stable `code` is derived from those normalized values and is the value used for authorization lookup. The mutable `name` is a display label and is never used as the authorization key.

Regular permissions use `module.action`; `domain` remains part of the resource metadata (`module:domain`) and the semantic duplicate check. The reserved protected capability uses a third dotted segment, for example `roles.manage.protected` and `permissions.manage.protected`.

The existing Prisma schema already enforces `AuthorizationPermission.code @unique`. Because the canonical code is derived from the normalized capability identity, this database constraint is the final consistency guard against concurrent duplicate creates; application-level duplicate checks remain an early business validation layer.

## Lifecycle policy

Permission creation, update, and deletion are authorized in the application service and additionally protected by presentation guards. Regular users have no permission-management capability. Permission reads require `permissions.read` or `permissions.manage`; mutations require `permissions.manage`.

Critical identifiers are protected by stable code. The protected set currently includes `roles.manage.protected` and `permissions.manage.protected`. Protected permission updates/deletes require the dedicated `permissions.manage.protected` capability and are audited when denied.

A permission cannot be deleted while `AuthorizationRolePermission` references it. Deletion does not rely on a destructive cascade and maps foreign-key conflicts to the business error `PERMISSION_IN_USE`.

## Layering

`PermissionEntity` contains domain invariants only. `PermissionRepository` is the application/domain persistence abstraction. `PrismaPermissionRepository` and `PrismaPermissionMapper` are infrastructure concerns. Controllers only handle HTTP input/output and never expose Prisma records.

Permission CRUD mutations emit `PERMISSION_CREATED`, `PERMISSION_UPDATED`, and `PERMISSION_DELETED` audit events. Blocked dependency/protected operations emit security audit events without recording credentials, tokens, secrets, or arbitrary database objects.
