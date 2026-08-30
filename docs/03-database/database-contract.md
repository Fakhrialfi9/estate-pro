# Database Configuration Contract

`DATABASE_URL` is the canonical and only application database target.

## Canonical input

```text
DATABASE_URL=mysql://<user>:<password>@<host>:<port>/<database>
```

The NestJS runtime parses the URI into adapter configuration. Prisma CLI consumes the same environment variable directly. This prevents an application process and Prisma CLI from silently targeting different databases.

## Environment behavior

Development, staging, and production must each inject a complete `DATABASE_URL` through environment configuration or a secret manager. Do not set `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, or `DATABASE_PASSWORD` as alternate application connection inputs.

Pool settings remain separate because they affect connection behavior rather than database identity:

- `DATABASE_POOL_CONNECTION_LIMIT`
- `DATABASE_CONNECT_TIMEOUT_MS`
- `DATABASE_ACQUIRE_TIMEOUT_MS`
- `DATABASE_POOL_IDLE_TIMEOUT_SEC`

## Migration contract

The deployable migration command is:

```bash
npm run prisma:deploy
```

which executes `prisma migrate deploy` against the canonical `DATABASE_URL`.

A fresh database must be able to apply the complete checked-in migration history. Production deployments must never use `prisma migrate reset`.

## Seed contract

Seeding uses the same canonical `DATABASE_URL`. Seed credentials are injected through `SEED_ADMIN_PASSWORD` and `SEED_DEVELOPMENT_USER_PASSWORD` and are never committed to source control.

CI validates seed reproducibility by migrating an isolated fresh database and executing the seed twice. The second run must be idempotent rather than creating duplicate identities or role assignments.

## Configuration mismatch protection

The application configuration parser derives host, port, database, username, and password exclusively from `DATABASE_URL`. Tests intentionally populate conflicting legacy environment variables and verify that they cannot override the canonical URI.
