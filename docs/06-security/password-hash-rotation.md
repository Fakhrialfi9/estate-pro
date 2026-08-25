# Password Hash Rotation Strategy

Estate Pro stores passwords only as Argon2id hashes. The active Argon2 parameters are centralized under `auth.passwordHashing` and are applied by `PasswordHasherService`.

A credential can be checked with `PasswordHasherService.needsRehash(hash)`. When Argon2 parameters are increased, the application can rehash the password after a successful verification and persist the stronger hash. No plaintext password is persisted or logged during this process.

The rotation strategy is upgrade-on-success: existing hashes remain valid until their owner authenticates successfully, then the hash is transparently upgraded to the current policy. A forced global password reset is not required solely because Argon2 parameters changed.

Reset tokens use a separate SHA-256 digest representation and are not part of credential password hashes.
