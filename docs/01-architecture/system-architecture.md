# System Architecture

## Scope

This document describes the architecture that is actually present in `main` at Step 121–140. Empty/scaffolded modules are documented as scaffolds; they are not described as implemented business capabilities.

## Runtime boundary

```text
Client
  |
  v
HTTP / Express / NestJS bootstrap
  |
  +--> global validation / versioning / security middleware
  |
  +--> Controller / presentation (where implemented)
  |
  +--> Application services / use cases (where implemented)
  |
  +--> Domain (currently scaffolded for the business modules)
  |
  +--> Infrastructure adapters
         |
         +--> Prisma / MariaDB
         +--> logging / Pino
         +--> OpenTelemetry
         +--> health infrastructure
```

`AppModule` composes configuration, logging, throttling, authentication, database, health, and observability. The business modules are separated under `src/modules/*` with `application`, `domain`, `infrastructure`, and `presentation` boundaries where applicable.

## Dependency direction

The intended dependency rule is:

```text
Presentation -> Application -> Domain
Infrastructure -> Application/Domain contracts
Composition root -> all concrete implementations
```

A lower-level layer must not reach upward into a business module's internal implementation. Infrastructure details are kept outside the domain boundary.

## Domain isolation

Domain code must remain framework and persistence independent. It must not import Prisma, NestJS infrastructure packages, MariaDB, Pino, or OpenTelemetry.

At the time of this audit, the business-domain directories are scaffolds and contain no implemented domain objects. Therefore there is no domain-to-infrastructure import to leak.

## Application layer

Application code owns business-operation orchestration and use cases. It may coordinate domain behavior and repository abstractions. It must not directly use Prisma or SQL.

The current Auth module contains an application-level password hashing service. This is an application service rather than a domain entity/value object; it is intentionally not documented as a complete authentication use-case implementation.

## Infrastructure

`src/infrastructure` contains concrete technical concerns:

- database and Prisma integration
- logging
- OpenTelemetry observability

Prisma is located under `src/infrastructure/database/prisma`. The application and domain layers must consume abstractions rather than Prisma model types.

## Presentation

HTTP transport concerns belong in controllers/presentation: parsing requests, DTO validation, invoking an application operation, and mapping the response/error. Business rules and persistence do not belong here.

## Module boundaries

Current module roots include `auth`, `content`, `crm`, `health`, `permissions`, `property`, `roles`, `sales`, `services`, `system`, and `users`.

Business modules use explicit internal boundaries. Cross-module access must target a public application contract/provider, not another module's internal repository, domain implementation, or Prisma model.

Several business modules are currently scaffolds. Their existence does not imply that their CRUD/use cases are implemented.

## Database boundary

The only approved location for direct Prisma integration is the infrastructure database boundary. Database credentials/configuration enter through `src/config` and are consumed by infrastructure.

No controller, domain object, or application use case should construct or query `PrismaClient` directly.

## Configuration

Configuration is centralized in `src/config/configuration.ts` and its focused config files. Joi validates environment variables during application bootstrap. Secrets are supplied through the environment and are never documented with real values.

## Observability and health

Logging is configured through `nestjs-pino`; request IDs and OpenTelemetry trace identifiers are included when available. OpenTelemetry is initialized before application imports. Health and observability are composed as infrastructure/application modules by `AppModule`.

## Testing boundary

Tests are separated under `test/unit`, `test/integration`, `test/e2e`, `test/security`, `test/health`, and `test/observability`. Test commands are defined by `package.json`; documentation must only reference those scripts.

## Architecture invariants

1. No circular module dependency.
2. Domain has no infrastructure/framework dependency.
3. Common code has no business-domain dependency.
4. Cross-module dependencies are explicit and minimal.
5. Prisma is an infrastructure detail.
6. Controllers do not contain business logic.
7. Business operations belong in application/use-case code.
8. Persistence details do not leak through domain/application contracts.
9. Do not introduce `forwardRef()` to hide a cycle; remove the architectural cycle instead.
