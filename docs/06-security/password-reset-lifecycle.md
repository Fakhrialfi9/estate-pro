# Password Reset Lifecycle

Estate Pro password reset is a stateful, single-use security flow:

1. The reset request accepts an identity and always returns a generic success response.
2. For an accessible account with credentials, the application generates 32 cryptographically random bytes and encodes them as a URL-safe token.
3. Only the SHA-256 digest of the token is persisted. The plaintext token exists only at the delivery boundary.
4. The persisted token has an explicit expiration timestamp and unused state.
5. Reset consumption is performed in a database transaction. A conditional update requires `usedAt IS NULL` and `expiresAt > now`, so concurrent attempts cannot both consume the same token.
6. The credential password is replaced with a new Argon2id hash in the same transaction.
7. Existing active sessions are revoked in the same transaction after a successful password reset.
8. A consumed, expired, or unknown token is rejected and cannot be replayed.
9. Passwords, reset tokens, token digests, and password hashes are not returned through API responses or written to application logs.

The reset flow intentionally does not expose account existence through its public request endpoint.
