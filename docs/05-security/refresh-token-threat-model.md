# Refresh Token Threat Model — STEPS 249–260

| Step | Threat | Current mitigation | Verification |
|---|---|---|---|
| 249 | Token theft | 32-byte random opaque token, base64url transport, SHA-256 digest-only storage, HTTPS deployment contract, no secret logging | Refresh lifecycle E2E + code audit |
| 250 | Replay | Every successful refresh consumes/revokes the presented token and creates a replacement | Refresh lifecycle E2E replay cases |
| 251 | Replay after rotation | Reuse detection revokes the refresh family and authentication session when the old token is presented | Family/session reuse tests |
| 252 | Session hijacking | Refresh family is bound to a server-side session; JWT `sid` is checked against active session state; sessions can be revoked | Session/guard tests and lifecycle E2E |
| 253 | Long-lived credential abuse | Default refresh lifetime is 30 days; session lifetime is bounded and refresh rejects expired session state | Configuration + lifecycle E2E |
| 254 | Database leak | Only `token_hash` is persisted; it is unique and 64 hex characters | Prisma schema + persistence tests |
| 255 | Log leak | Refresh service audits/logs identifiers, reasons and correlation metadata, not raw token material; response uses `no-store` | Audit-redaction and lifecycle tests |
| 256 | Parallel refresh race | Conditional affected-row update plus transaction and row lock resolves concurrent use deterministically | Concurrent refresh E2E |
| 257 | Logout bypass | Logout revokes the current session and refresh state for the session; logout-all revokes all user sessions/tokens | Logout lifecycle E2E |
| 258 | Password compromise persistence | Password-change/reset security events revoke sessions and refresh-token state | Security-event lifecycle E2E |
| 259 | Disabled account persistence | Refresh queries require active, non-deleted user and active session/family state | Disabled-account lifecycle E2E |
| 260 | CSRF | Refresh transport is request-body based, not cookie/ambient-authentication based; CORS is explicit; refresh responses are `no-store` and no cookie is issued | Dynamic HTTP transport test |

## Token theft
The refresh token has 256 bits of randomness. SHA-256 is sufficient for protecting a credential with this entropy because offline guessing is not practical. No raw refresh value belongs in application, audit, tracing, or metrics data.

## Session binding
The effective refresh authorization is the tuple of token generation + family + active server-side session + active user state. A valid token from a revoked/expired session is rejected.

## CSRF decision
The canonical refresh credential is sent explicitly in the JSON request body. The server does not authenticate refresh requests from a browser cookie. Therefore the browser does not automatically attach the refresh credential cross-site. CORS remains explicit defense-in-depth; if a future cookie-based authentication transport is introduced, a CSRF token/origin-validation policy must be added before release.
