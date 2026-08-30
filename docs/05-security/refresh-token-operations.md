# Refresh Token and Production Security Contract

## Token lifecycle

Refresh tokens are opaque 32-byte random values encoded as base64url. Only a SHA-256 digest is persisted. The plaintext token exists only at issuance/response boundaries and is never part of logs, audit payloads, metrics, or traces.

Rotation is transactional. The current token is conditionally marked consumed/revoked before the replacement token is created. Concurrent requests against the same token are resolved with affected-row semantics and row locking; a reuse result revokes the token family and its authentication session.

## Audit events

The canonical refresh lifecycle events are:

- `REFRESH_TOKEN_ISSUED`
- `REFRESH_TOKEN_ROTATED`
- `REFRESH_TOKEN_REVOKED`
- `REFRESH_TOKEN_REUSE_DETECTED`
- `REFRESH_TOKEN_FAMILY_REVOKED`
- `SESSION_REFRESH_REVOKED`
- `REFRESH_FAILED`

Audit records may contain actor/subject UUIDs, session/family identifiers, reason/category, request ID, IP address, and user agent. They must never contain a raw refresh token, JWT secret, password, encryption key, or cookie value.

## Observability contract

Refresh instrumentation exposes the following metric names when the OpenTelemetry metrics SDK/exporter is enabled:

- `auth_refresh_success_total`
- `auth_refresh_failure_total`
- `auth_refresh_reuse_detection_total`
- `auth_refresh_family_revocation_total`
- `auth_refresh_latency_ms`

The refresh span is named `auth.refresh_token`. Only request correlation metadata is attached by the refresh-specific instrumentation; token values and authentication secrets are intentionally absent.

A reuse signal should page or create a security incident signal only after aggregation. A baseline alert is three or more reuse detections in ten minutes:

```yaml
expr: increase(auth_refresh_reuse_detection_total[10m]) >= 3
for: 5m
```

## Database configuration

`DATABASE_URL` is the single canonical database target. Application runtime, Prisma CLI configuration, migrations, and seed tooling must consume this value. Host, port, database name, username, and password are parsed from `DATABASE_URL`; they are not separately configurable application inputs.

Development/staging/production must each provide their own complete `DATABASE_URL`. A fresh environment must be initialized with `prisma migrate deploy`; `prisma migrate reset` is a development-only destructive operation and is never a production deployment strategy.

## CORS and CSP

Production CORS must contain the exact frontend origin(s), supplied through `SECURITY_CORS_ORIGINS`; localhost is not a production origin. `X-Request-Id` is an allowed request header because the API propagates request correlation IDs.

CSP/HSTS examples must describe the actual runtime policy controlled by `SECURITY_CSP_ENABLED` and `SECURITY_HSTS_ENABLED`. Production should keep both enabled unless an explicit deployment exception is documented.

## Proxy and HTTPS

Production TLS must terminate at an ingress/load balancer or be served directly by an HTTPS-aware deployment. When the application is behind a trusted proxy, `SECURITY_TRUST_PROXY` must explicitly identify the proxy hop(s) or trusted network. Do not set a blanket `true` trust value.

The application trusts forwarded request metadata only under that explicit proxy policy. Refresh-token transport must therefore use HTTPS end-to-end from browser/client to the trusted TLS boundary.

## Rate limits

The refresh endpoint is independently throttled through `REFRESH_RATE_LIMIT` and `REFRESH_RATE_LIMIT_TTL_MS`. The global application throttle remains separate. Production values must be sized for expected legitimate traffic and monitored for abuse rather than disabled.

## Secret management

Production values for `JWT_SECRET` and `TWO_FACTOR_ENCRYPTION_KEY` must be supplied by the hosting platform/secret manager. They must not appear in Git, Docker build context, Docker layers, logs, traces, or audit records.

Seed credentials are environment-managed for development/test use only. The repository intentionally contains no seed password literals.

## Container runtime

The production container is multi-stage, runs compiled JavaScript, installs only production dependencies in the runtime stage, runs as the non-root `node` user, and contains a liveness healthcheck. Test files, `.env` files, Git metadata, logs, and local development artifacts are excluded by `.dockerignore`.

## Database backup and restore

A production deployment must have an operational MariaDB backup policy independent of the application container. The minimum procedure is:

```bash
mariadb-dump --single-transaction --routines --triggers "$DATABASE_URL" > estate-pro.sql
mariadb "$DATABASE_URL" < estate-pro.sql
```

The actual production provider/secret manager should inject the connection URI rather than placing credentials in shell history or scripts. Backups must be encrypted at rest, access-controlled, retained according to business requirements, and periodically restored in an isolated environment to verify recoverability.

## Connection capacity

`DATABASE_POOL_CONNECTION_LIMIT` must be selected against the database server's maximum connection capacity and the number of application instances. A safe starting point is to divide the available connection budget across replicas and leave headroom for administrative and migration connections.
