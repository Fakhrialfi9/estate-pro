# Authentication Security

## Access token
Access tokens are JWT bearer tokens. The configured default lifetime is 15 minutes. Verification enforces the configured secret, issuer, audience, and an explicit HS256/HS384/HS512 algorithm allow-list, plus required `sub`, `sid`, `iat`, and `exp` claims.

## Server-side session
Login creates a fresh 32-byte random session secret. Only its SHA-256 digest is persisted. The JWT `sid` identifies/binds the access token to that session. Every protected request verifies that the session is still active and unexpired.

## Refresh token
A refresh token is a fresh 32-byte random opaque value encoded as base64url. Only its SHA-256 digest is persisted. Refresh is transactional and rotating; reuse revokes the family and session.

## Password security
Passwords are verified with Argon2. Unknown identities still incur password-hashing work to reduce user enumeration. Password-change/reset security events revoke existing authentication state through the security/session layer.

## 2FA
TOTP enrollment and login challenges are handled by `TwoFactorService`. Challenge tokens are short-lived and purpose-bound. TOTP verification is rate-limited/locked after repeated failures. Recovery codes are protected and single-use.

## Authorization
Authentication and authorization are separate boundaries. RBAC is permission based and property access adds object-level ownership/agent-assignment checks.
