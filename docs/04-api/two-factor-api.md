# 2FA API

Base path `/api/v1/auth/2fa`.

- `GET /auth/2fa` — authenticated 2FA status.
- `POST /auth/2fa/enrollment` — start TOTP enrollment; returns provisioning URI, not the encrypted storage secret.
- `POST /auth/2fa/enrollment/verify` — verify a 6-digit TOTP and enable 2FA; returns recovery codes once.
- `POST /auth/2fa/verify` — complete a login MFA challenge using a TOTP or recovery code.
- `POST /auth/2fa/recovery-codes/regenerate` — re-authenticate with password/TOTP and replace recovery codes.
- `POST /auth/2fa/disable` — securely disable 2FA with password plus TOTP/recovery verification.

All mutation endpoints are rate-limited. Challenge and recovery values are single-use and security events are audited.
