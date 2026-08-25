# Authentication API

Base path: `/api/v1`.

## `POST /auth/login`

Public primary-authentication endpoint. The controller delegates to `LoginService`. Successful primary authentication returns a session-bound bearer access token with `tokenType` and `expiresIn`. When 2FA is enabled, the response is an MFA challenge instead of an access token. Invalid credentials return `401` without revealing whether an account exists.

## `POST /auth/logout`

Requires `JwtAuthGuard`. The controller revokes the current session using the `sub` and `sid` claims from the verified token. A successful response is `{ "success": true }`.

## `GET /auth/me`

Requires `JwtAuthGuard`. Returns the safe user serializer. Credential hashes, session secrets and 2FA secrets are not serialized.

## Session endpoints

`GET /auth/sessions` lists safe session metadata for the authenticated user. `POST /auth/sessions/logout-all` revokes all own sessions. `DELETE /auth/sessions/:id` revokes one owned session by its public numeric identifier. Administrative revocation is exposed at `POST /admin/session-management/users/:userUuid/sessions/:id/revoke` behind the session-admin guard.

## 2FA endpoints

`GET /auth/2fa` returns only enabled state. `POST /auth/2fa/enrollment` starts enrollment. `POST /auth/2fa/enrollment/verify` verifies the enrollment TOTP. `POST /auth/2fa/verify` completes a login challenge using TOTP or a recovery code. `POST /auth/2fa/recovery-codes/regenerate` and `POST /auth/2fa/disable` require secure re-authentication.
