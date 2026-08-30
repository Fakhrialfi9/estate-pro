# Entity Definitions

The following inventory is derived from the current Prisma split schema and implemented modules.

## Authentication and user security
- `AuthenticationUser`: identity, status, active/verified state.
- `AuthenticationUserCredential`: password hash owned by a user.
- `AuthenticationUserSecurity`: failed-login/lockout security state.
- `AuthenticationUserProfile`: user profile data.
- `AuthenticationUserSession`: server-side session with hashed session secret, user agent/IP, expiry and revocation state.
- `AuthenticationRefreshTokenFamily`: refresh-token family bound to a user and session, with family revocation state.
- `AuthenticationRefreshToken`: one opaque-token generation represented by a unique SHA-256 `tokenHash`, expiry, consumption and revocation state.
- `AuthenticationPasswordResetToken`: password-reset state.
- `AuthenticationUserTwoFactor`: TOTP/2FA enrollment state.
- `AuthenticationUserTwoFactorChallenge`: short-lived MFA challenge state.
- `AuthenticationUserTwoFactorRecoveryCode`: one-time recovery-code state.

## Authorization
The authorization schema contains roles, permissions, role-permission assignments, and user-role assignments. Permission checks are performed through backend guards/policies.

## Property
The property schema is split across property, type/category/subcategory, location, facility, details, extras, and listing files. Property access additionally models agent assignments; object-level authorization validates ownership or authorized assignment.

## Audit
Audit logs and audit-log changes provide an append-oriented security trail. Secret material is excluded from audit metadata and change payloads.

This file intentionally describes only entities confirmed by the current schema/module layout; scaffolded bounded contexts are not invented as database entities.
