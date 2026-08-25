# Authorization API

Authorization is resolved from persistent role and permission assignments rather than trusting a permission list supplied by the HTTP client. Protected controllers use `JwtAuthGuard` followed by `AuthorizationGuard`; authorization requirements are declared with permission/role decorators.

## Roles

- `GET /roles` and `GET /roles/:uuid` require `roles:read`.
- `POST /roles`, `PUT /roles/:uuid`, and `DELETE /roles/:uuid` require `roles:manage`.
- `GET /roles/:uuid/permissions` requires `roles:read`.
- `POST /roles/:uuid/permissions` and `DELETE /roles/:uuid/permissions/:permissionUuid` require `roles:manage`.

## User roles

- `GET /users/:userUuid/roles` requires `roles:read`.
- `POST /users/:userUuid/roles` requires `roles:manage`.
- `DELETE /users/:userUuid/roles/:roleUuid` requires `roles:manage`.

## Permissions

- `GET /permissions` and `GET /permissions/:uuid` require either `permissions:read` or `permissions:manage`.
- `POST /permissions`, `PUT /permissions/:uuid`, and `DELETE /permissions/:uuid` require `permissions:manage`.

## Authorization decision

For each protected request the guard resolves the user's effective authorization snapshot. Missing requirements result in `403`. Missing or invalid authentication results in `401`. Mutating role/permission assignments is audited by the associated application service.
