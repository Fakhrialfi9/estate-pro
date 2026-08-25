# Role API

Base path `/api/v1/roles`.

Read operations require `roles:read`. Mutations require `roles:manage`.

- `GET /roles`
- `GET /roles/:uuid`
- `POST /roles`
- `PUT /roles/:uuid`
- `DELETE /roles/:uuid`
- `GET /roles/:uuid/permissions`
- `POST /roles/:uuid/permissions`
- `DELETE /roles/:uuid/permissions/:permissionUuid`

User-role endpoints live under `/api/v1/users/:userUuid/roles` and use the same read/manage permissions.
