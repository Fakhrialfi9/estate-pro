# Authentication API Strategy

Estate Pro uses a short-lived JWT access token bound to a server-side session. The access token contains a session identifier and every protected request verifies both the JWT and the active session.

The current architecture does **not** expose a refresh-token endpoint. Session renewal is intentionally handled through the configured access-token/session lifetime rather than introducing a second long-lived credential type.

## Public endpoint

- `POST /api/v1/auth/login`

## Protected endpoints

- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- session management endpoints
- 2FA enrollment, verification, disable and recovery-code management
- user/profile/password management
- role/permission administration
- audit-log queries

Swagger exposes the bearer JWT security scheme as `bearer`. No real secret, token, session secret or 2FA secret is included in the OpenAPI contract.

Authorization requirements are represented through the same permission metadata used by the server-side authorization guard. Controller documentation must not claim a permission that differs from the runtime guard requirement.
