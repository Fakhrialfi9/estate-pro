# Security Rules

- Authentication failures return generic `401` responses and do not reveal account existence.
- JWT verification requires valid signature, issuer, audience, algorithm, `sub`, `sid`, `iat`, and `exp` claims.
- Protected sessions are checked against persisted session state; logout/revocation invalidates the token session.
- Passwords use Argon2 hashes and are never accepted in user CRUD DTOs.
- Password changes require the current password, a valid replacement according to the domain policy, and matching confirmation; existing sessions are revoked.
- 2FA provisioning secrets are encrypted before persistence; recovery codes are hashed and single-use.
- MFA challenge tokens have a dedicated purpose and expiry and are consumed after successful verification.
- Authorization is explicit and resolved from persisted role/permission state.
- Audit logs are immutable from the API perspective; audit reads require `audit:read` and are themselves audited.
- Security tests cover authentication, authorization, IDOR/ownership, privilege boundaries, password handling, JWT, session state, 2FA/recovery, input validation, injection/XSS payload handling, sensitive-data exposure, headers and rate-limit policy.
