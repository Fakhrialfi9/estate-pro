# Database Design

## Provider and source of truth
Prisma uses MySQL-compatible MariaDB. The root schema config is in `prisma/schema/schema.prisma`; domain models are split into `prisma/schema/<domain>/*.prisma` files.

## Conventions
- Database names use snake_case through Prisma `@map`/`@@map` where needed.
- Public business identifiers use UUIDs where the API exposes them.
- Internal relational identifiers frequently use unsigned `BIGINT`.
- Timestamps are explicit and security-sensitive state transitions record `createdAt`, `updatedAt`, `revokedAt`, `consumedAt`, or expiry values where applicable.

## Constraints and indexes
Security-sensitive lookups are indexed/unique where required. Refresh-token hashes are unique and indexed via the unique constraint; refresh families index user/session/revocation state; sessions index user/revocation/expiry.

## Migrations
Production schema changes must use `prisma migrate deploy`. Destructive reset is development/test only. CI validates migrations against a fresh MariaDB database.

## Security considerations
Never persist raw refresh tokens. Session secrets are stored as SHA-256 digests. Passwords are Argon2 hashes. MFA secrets are encrypted and recovery codes are hashed. Application code must scope security-sensitive queries to the owning user/session/family.
