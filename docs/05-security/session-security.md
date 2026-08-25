# Session Security Policy

Estate Pro uses a server-side session resource bound to the authenticated identity. The JWT access token carries `sub` and `sid`; the access token is not itself the session.

- Session secrets are generated server-side with 256 bits of cryptographic randomness.
- The raw session secret is never persisted. The existing `authentication_user_sessions.session_id` column stores a SHA-256 digest.
- The bearer secret is never returned by session-list endpoints and is not used as a URL parameter.
- Session management endpoints use the non-secret database record ID and always scope queries by the authenticated principal.
- Sessions are active only while `revokedAt` is null and `expiresAt` is in the future. Revoked and expired sessions cannot be revived.
- Login always creates a new session after credentials are verified, which prevents an attacker-controlled pre-auth identifier from becoming authenticated.
- Password change, password reset, account disable/lock, compromise, and security-state changes revoke all existing sessions. The user must authenticate again.
- Logout revokes the current session. Logout-all revokes all currently active sessions owned by the principal.
- Concurrent-session policy is unlimited active sessions; explicit revocation is available per session and across all sessions. No arbitrary eviction is performed.
- Device metadata is informational only. User-Agent is truncated before persistence and is never treated as authentication proof.
- IP metadata comes from the framework-resolved request IP. Client-supplied `X-Forwarded-For` is not parsed directly by the session layer.
- Admin session revocation requires the existing authorization capability `sessions:manage` and performs the same target-session ownership lookup before mutation.

Rotation policy: successful authentication creates a new session. Password/security changes revoke old sessions instead of silently retaining the current bearer session. Privilege-elevation rotation is reserved for the existing authorization flow and is not implemented as a second session mechanism.
