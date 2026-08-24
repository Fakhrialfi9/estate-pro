# Data Flow

## HTTP request flow

The documented flow is the implementation target and must not be used to imply business endpoints that do not yet exist.

```text
Client
  |
  v
NestJS / Express bootstrap
  |
  +--> security middleware / request ID / rate limiting
  |
  +--> Pino request logging / redaction
  |
  v
Controller / presentation
  |
  +--> DTO parsing + validation
  |
  v
Application service / use case
  |
  +--> domain behavior
  |
  +--> repository abstraction
  |
  v
Infrastructure adapter
  |
  v
Prisma
  |
  v
MariaDB
```

The business modules are currently scaffolded, so the complete business request path is not yet exercised for Property, Sales, Services, Content, CRM, Users, Roles, or Permissions.

## Configuration flow

```text
process.env
   |
   v
Joi validation in configuration.ts
   |
   v
focused config factories
   |
   v
ConfigModule
   |
   +--> bootstrap
   +--> logging
   +--> throttling
   +--> auth service
   +--> database infrastructure
   +--> observability
```

Missing/invalid required environment values fail application configuration validation rather than being silently accepted.

## Authentication flow

The current implementation provides an application-level `PasswordHasherService` using Argon2id and configuration-driven cost parameters. This is a security primitive, not a claim that a full login/session flow is currently implemented.

```text
Authentication use case (when implemented)
  -> password hashing service
  -> Argon2id
```

## Error flow

```text
Controller / provider
   |
   v
exception
   |
   v
GlobalExceptionFilter
   |
   +--> structured HTTP error response
   +--> sanitized logging
```

The filter is registered globally by `AppModule`.

## Logging flow

Requests are handled by the infrastructure `LoggingModule` using Pino HTTP logging. Request IDs are accepted only within the configured validation constraints or generated locally. Sensitive paths are redacted before log output. HTTP status determines log level, and OpenTelemetry trace/span identifiers are attached when an active span exists. Health requests are intentionally excluded from automatic request logging to reduce operational noise.

## Tracing and metrics

OpenTelemetry is initialized before application imports. Service identity is derived from application configuration, sampler/exporter settings are controlled through standard `OTEL_*` environment variables, and metrics/tracing can be disabled for deterministic test/runtime probes.

## Health flow

Health endpoints/checks are isolated in the Health module. Liveness only proves that the process is serving; readiness verifies the database dependency through the `HealthDependency` contract and maps dependency failure to HTTP 503 without exposing infrastructure details.

## Database flow

Only infrastructure owns direct Prisma access. Domain/application code must depend on repository contracts rather than Prisma client/model types. Health uses the same principle through its narrow database-check contract.

## Test flow

Tests are organized by concern rather than mixed into production modules:

- `test/unit`
- `test/integration`
- `test/e2e`
- `test/security`
- `test/health`
- `test/observability`

The actual commands are defined in `package.json` and documented in `testing.md`. `npm run check:runtime` validates the compiled application by probing the versioned liveness endpoint.
