# Authentication & Security Workflows

## Login without MFA
1. Client sends identifier/password to `POST /api/v1/auth/login`.
2. User/account state and lockout state are checked.
3. Password is verified with Argon2.
4. A fresh server-side session secret is generated and only its digest is persisted.
5. An access JWT containing `sub` and `sid` is issued.
6. A refresh-token family with an opaque refresh token is persisted as a digest.

## Login with MFA
1. Primary credentials pass.
2. A short-lived, purpose-bound MFA challenge is returned.
3. `POST /api/v1/auth/2fa/verify` validates TOTP or a one-time recovery code.
4. Only after successful MFA is a session/access/refresh credential set issued.

## Refresh
1. Client sends the opaque refresh token in the JSON body.
2. The server hashes it and locates the token generation.
3. User/session/family active state and expiry are checked.
4. The presented token is atomically consumed/revoked.
5. A replacement refresh token is created in the same transaction.
6. Concurrent reuse is treated as a security signal and revokes the family/session.

## Logout
The authenticated access token identifies the current session. Logout revokes the session and refresh-token state bound to it. Subsequent access-token checks fail because the session is inactive; subsequent refresh requests fail because the token/session state is revoked.

## Password change/reset
A password security event revokes existing authentication state through the session/refresh security port. The old refresh credentials therefore cannot continue an authenticated session.

## Account disable/suspend/delete
Refresh authorization checks user account accessibility in addition to token/session state. Disabled, suspended, deleted, or otherwise inaccessible users cannot mint a new access token through refresh.

## Security events
Security-relevant outcomes record audit events with identifiers, reasons, request correlation and network metadata where configured. Raw credentials are excluded.
