# System Architecture

## Scope

This document describes the architecture actually present in `main` for the Step 71–140 scope. Empty/scaffolded business modules are documented as scaffolds; they are not described as implemented business capabilities.

## Runtime boundary

```text
Client
  |
  v
HTTP / Express / NestJS bootstrap
  |
  +--> global validation / versioning / security middleware
  |
  +--> structured request logging / correlation ID
  |
  +--> Controller / presentation (where implemented)
  |
  +--> Application services / use cases (where implemented)
  |
  +--> Domain (currently scaffolded for most business modules)
  |
  +--> Infrastructure adapters
         |
         +--> Prisma / MariaDB
         +--> Pino / NestJS logging
         +--> OpenTelemetry
         +--> health infrastructure
```

`AppModule` composes configuration, the dedicated `LoggingModule`, throttling, authentication, database, health, and observability. The business modules are separated under `src/modules/*` with `application`, `domain`, `infrastructure`, and `presentation` boundaries where applicable.

## Dependency direction

The intended dependency rule is:

```text
Presentation -> Application -> Domain
Infrastructure -> Application/Domain contracts
Composition root -> all concrete implementations
```

A lower-level layer must not reach upward into a business module's internal implementation. Infrastructure details are kept outside the domain boundary.

The repository includes `scripts/check-architecture-graph.mjs`, invoked by `npm run check:architecture`, to inspect the TypeScript source import graph. It fails on circular dependencies and on cross-module imports that bypass another module's public module entry point.

## Domain isolation

Domain code must remain framework and persistence independent. It must not import Prisma, NestJS infrastructure packages, MariaDB, Pino, or OpenTelemetry.

At the time of this implementation, the business-domain directories are scaffolds and contain no domain-to-infrastructure import to leak.

## Application layer

Application code owns business-operation orchestration and use cases. It may coordinate domain behavior and repository abstractions. It must not directly use Prisma or SQL.

The current Auth module contains an application-level password hashing service. This is an application service rather than a domain entity/value object; it is intentionally not documented as a complete authentication use-case implementation.

Health uses a narrow application contract (`HealthDependency`) and binds the concrete database health adapter in the module composition root. This keeps the health service independent from Prisma infrastructure details.

## Infrastructure

`src/infrastructure` contains concrete technical concerns:

- database and Prisma integration
- structured HTTP logging through Pino/NestJS Pino
- OpenTelemetry observability

Prisma is located under `src/infrastructure/database/prisma`. The application and domain layers must consume abstractions rather than Prisma model types.

## Presentation

HTTP transport concerns belong in controllers/presentation: parsing requests, DTO validation, invoking an application operation, and mapping the response/error. Business rules and persistence do not belong here.

## Module boundaries

Current module roots include `auth`, `content`, `crm`, `health`, `permissions`, `property`, `roles`, `sales`, `services`, `system`, and `users`.

Business modules use explicit internal boundaries. Cross-module access must target the public module entry point or a deliberately exposed application contract/provider, not another module's internal repository, domain implementation, or Prisma model. The architecture graph checker rejects relative cross-module imports that bypass the target module entry point.

Several business modules are currently scaffolds. Their existence does not imply that their CRUD/use cases are implemented.

## Database boundary

The only approved location for direct Prisma integration is the infrastructure database boundary. Database credentials/configuration enter through `src/config` and are consumed by infrastructure.

No controller, domain object, application use case, or other non-infrastructure source should construct or query `PrismaClient` directly. The architecture checker enforces the absence of Prisma references outside `src/infrastructure`.

## Configuration

Configuration is centralized in `src/config/configuration.ts` and its focused config files. Joi validates environment variables during application bootstrap. Secrets are supplied through the environment and are never documented with real values.

## Logging

`src/infrastructure/logging/logger.module.ts` owns the Pino/NestJS Pino integration. It emits structured request logs with service/environment/request identifiers, HTTP metadata, status-aware levels, and OpenTelemetry trace/span IDs when available. Sensitive request/response paths are centrally redacted from `src/common/constants/security.constants.ts`.

## Observability and health

OpenTelemetry is initialized before application imports. Service name/version/environment and sampler/exporter settings are environment-driven, and shutdown failures are isolated from application shutdown. Health is isolated in `HealthModule` with separate liveness and readiness semantics; readiness checks the infrastructure database adapter and returns only machine-readable status information.

## Testing boundary

Tests are separated under `test/unit`, `test/integration`, `test/e2e`, `test/security`, `test/health`, and `test/observability`. Test commands are defined by `package.json`; compiled runtime validation is provided by `npm run check:runtime`. GitHub Actions runs the repository quality gate on `main` pushes.

## Architecture invariants

1. No circular module/source dependency.
2. Domain has no infrastructure/framework dependency.
3. Common code has no business-domain dependency.
4. Cross-module dependencies are explicit and minimal.
5. Prisma is an infrastructure detail.
6. Controllers do not contain persistence/business implementation logic.
7. Business operations belong in application/use-case code.
8. Persistence details do not leak through domain/application contracts.
9. Do not introduce `forwardRef()` to hide a cycle; remove the architectural cycle instead.
10. Runtime validation must exercise the compiled `dist` output, not only TypeScript compilation.
