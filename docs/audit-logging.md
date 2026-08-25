# Estate Pro Audit Logging Security Policy

## Scope

Audit logging is an append-only security record for authentication, identity, authorization, session, 2FA, and privileged audit-log access events.

## Data policy

Audit records store an explicit actor identity, optional subject/resource identity, event action, result, safe failure reason, request correlation ID, policy-approved client IP, bounded user-agent, and timestamp. Passwords, password hashes, access tokens, refresh tokens, JWTs, session secrets, TOTP secrets, OTP values, recovery-code plaintext, encryption keys, database credentials, and private cryptographic material are never valid audit fields.

Before/after data uses an explicit per-resource allowlist. Unknown fields and secret-bearing field names are excluded rather than serialized automatically.

## IP and user-agent policy

`request.ip` is used, so proxy-derived addresses are only trusted when the existing `security.trustProxy` configuration explicitly enables the proxy policy. Arbitrary forwarded headers are not parsed by the audit layer. User-Agent is bounded by `AUDIT_LOG_USER_AGENT_MAX_LENGTH` and is forensic context only; it is not an authentication factor.

## Access control

Audit listing is exposed only through `GET /api/v1/system/audit-logs` and requires the existing authorization mechanism with `audit:read`. The access event itself is recorded after a successful read, so the read does not recursively trigger another read.

## Immutability and tamper resistance

The application exposes no audit-log update or delete endpoint, and the repository abstraction exposes only append (`record`) and read (`list`) operations. This is application-level append-only protection, not a cryptographic immutability claim. Production database administration should additionally grant the application account only the minimum privileges required for audit insertion/read access and keep DDL/maintenance credentials separate.

## Retention

Default retention is 365 days and is configurable through `AUDIT_LOG_RETENTION_DAYS` (30–3650 days). The application does not expose arbitrary deletion. Retention enforcement is an operational/database maintenance responsibility so audit deletion cannot be triggered by normal application users or generic CRUD tooling.

## Correlation and traceability

The existing `X-Request-ID` value is recorded when it matches the audit identifier policy. The audit layer never treats it as a credential and never executes it dynamically.
