# Permission API

Base path `/api/v1/permissions`.

Reads require `permissions:read` or `permissions:manage`; mutations require `permissions:manage`.

- `GET /permissions`
- `GET /permissions/:uuid`
- `POST /permissions`
- `PUT /permissions/:uuid`
- `DELETE /permissions/:uuid`

Permission mutations pass through `AuthorizationGuard` and the permission application service, which enforces system/dependency protections and records security-relevant audit context.
