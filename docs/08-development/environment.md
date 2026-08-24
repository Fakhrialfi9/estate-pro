# Environment

Environment variables are validated in `src/config/configuration.ts`. This document is derived from the actual validation schema and focused config consumers, not only from `.env.example`.

## Application and API

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Runtime environment; development/test/staging/production |
| `APP_NAME` | No | `estate-pro-api` | Service/application name |
| `APP_VERSION` | No | none | Application version |
| `APP_HOST` | No | `0.0.0.0` | HTTP bind host |
| `APP_PORT` | No | `3000` | HTTP port |
| `API_PREFIX` | No | `api` | HTTP global prefix |
| `API_VERSION` | No | `v1` | URI API version |

## Database

| Variable | Required | Default | Sensitivity |
|---|---|---|---|
| `DATABASE_URL` | Yes | none | Secret/credential-bearing |
| `DATABASE_HOST` | Yes | none | Infrastructure |
| `DATABASE_PORT` | No | `3306` | Infrastructure |
| `DATABASE_NAME` | Yes | none | Infrastructure |
| `DATABASE_USER` | Yes | none | Credential |
| `DATABASE_PASSWORD` | Yes | none | Secret |
| `DATABASE_POOL_CONNECTION_LIMIT` | No | `10` | Runtime tuning |
| `DATABASE_CONNECT_TIMEOUT_MS` | No | `5000` | Runtime tuning |
| `DATABASE_ACQUIRE_TIMEOUT_MS` | No | `10000` | Runtime tuning |
| `DATABASE_POOL_IDLE_TIMEOUT_SEC` | No | `300` | Runtime tuning |

`DATABASE_URL` must use the `mysql` URI scheme. Database credentials must never be committed.

## Authentication

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `JWT_SECRET` | Yes | none | JWT signing secret; minimum length enforced |
| `JWT_EXPIRES_IN` | No | `15m` | Token lifetime |
| `JWT_ISSUER` | No | `estate-pro-api` | JWT issuer |
| `JWT_AUDIENCE` | No | `estate-pro-client` | JWT audience |
| `JWT_ALGORITHM` | No | `HS256` | Allowed HMAC JWT algorithm |
| `TWO_FACTOR_ENCRYPTION_KEY` | Conditional | none | 2FA encryption key; required in staging/production |
| `AUTH_ARGON2_MEMORY_COST` | No | `19456` | Argon2 memory cost |
| `AUTH_ARGON2_TIME_COST` | No | `2` | Argon2 time cost |
| `AUTH_ARGON2_PARALLELISM` | No | `1` | Argon2 parallelism |

Production/staging secret placeholders are intentionally rejected by Joi validation.

## Security

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `SECURITY_CORS_ORIGINS` | Production/staging: yes | dev: `http://localhost:3000` | Allowed CORS origins |
| `SECURITY_RATE_LIMIT_TTL` | No | `60000` | Throttle window in ms |
| `SECURITY_RATE_LIMIT_MAX` | No | `100` | Requests allowed per throttle window |
| `SECURITY_BODY_LIMIT` | No | `1mb` | HTTP body limit |
| `SECURITY_COMPRESSION_THRESHOLD` | No | `1kb` | Compression threshold |
| `SECURITY_GRPC_MAX_MESSAGE_BYTES` | No | `1048576` | gRPC message size ceiling |
| `SECURITY_TRUST_PROXY` | No | unset | Explicit trusted proxy topology |
| `SECURITY_CSP_ENABLED` | No | `false` | Content Security Policy toggle |
| `SECURITY_HSTS_ENABLED` | No | `false` | HSTS toggle |

`SECURITY_TRUST_PROXY` must be configured only when the deployment topology is known.

## Logging

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `LOG_ENABLED` | No | `true` | Enable/disable application logging |
| `LOG_LEVEL` | No | `info` | Pino log level |

## OpenTelemetry

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OTEL_SERVICE_NAME` | No | none | Telemetry service name override |
| `OTEL_TRACING_ENABLED` | No | `true` | Tracing toggle |
| `OTEL_TRACES_EXPORTER` | No | `otlp` | `otlp`, `zipkin`, or `none` |
| `OTEL_TRACES_SAMPLER` | No | `parentbased_traceidratio` | Trace sampling strategy |
| `OTEL_TRACES_SAMPLER_ARG` | No | `0.1` | Sampling ratio/argument |
| `OTEL_METRICS_ENABLED` | No | `true` | Metrics toggle in validation schema; local example disables it |
| `OTEL_METRICS_EXPORTER` | No | `otlp` | `otlp`, `prometheus`, `console`, or `none` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | none | OTLP collector endpoint |
| `OTEL_METRIC_EXPORT_INTERVAL` | No | `60000` | Metric export interval in ms |

## Environment scope

- Development: use `.env.example` as the local shape and replace placeholders with local values.
- Test: provide isolated test configuration; do not reuse production credentials.
- Staging: production-style secret validation applies.
- Production: secrets are injected by the deployment secret manager/environment; never commit them.

## Source of truth

When a variable is added, removed, renamed, or its validation/default changes, update this document and `.env.example` in the same change.
