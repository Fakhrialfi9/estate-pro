# Coding Standard

## TypeScript

- Use the repository's strict TypeScript configuration.
- Prefer precise domain/application types over `any`.
- Keep public contracts narrow.
- Use `unknown` at unsafe boundaries and validate before narrowing.
- Keep ESM local imports using `.js` specifiers as required by the project.

## Naming

- Classes/services/modules: `PascalCase`.
- Variables/functions: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` when they are true constants.
- Files use the established NestJS naming convention (`*.module.ts`, `*.service.ts`, `*.controller.ts`, etc.).

## Folder responsibilities

```text
presentation/     HTTP/transport concerns
application/      use cases and orchestration
domain/           business rules and domain model
infrastructure/   persistence and external technical adapters
```

Do not place database code in controllers or domain code.

## Imports

- Keep imports explicit.
- Prefer stable public module contracts over internal-file imports.
- Do not import Prisma into domain/application code.
- Do not import business modules into `common` merely for convenience.
- Avoid circular dependencies; do not use `forwardRef()` as a substitute for correcting the dependency graph.

## DTO and controllers

DTOs define transport input/output shapes and validation. Controllers should parse/validate input, call an application operation, and map the result. Complex conditions, database calls, and domain mutations belong elsewhere.

## Use cases and application services

Use cases own application orchestration and transaction boundaries. Do not create a use case that adds no meaningful application behavior merely to satisfy a folder convention. Conversely, do not place domain rules in controllers because the use case is missing.

## Domain

Domain code is framework-independent. Keep it free of Prisma, NestJS infrastructure, HTTP concerns, logging libraries, telemetry, and database-specific types.

## Repositories

Define persistence contracts at the inner boundary when persistence is needed. Infrastructure implementations may use Prisma/MariaDB. Repository interfaces must not expose Prisma model types.

## Errors

Use typed/domain/application errors where appropriate and map them to transport responses at the presentation boundary. Avoid leaking SQL/Prisma internals to clients.

## Logging

Use the existing `src/infrastructure/logging/LoggingModule` backed by Pino/NestJS Pino. Keep request correlation, status-aware levels, and centralized redaction intact. Do not log secrets, passwords, tokens, database credentials, or encryption keys.

## Tests

Name tests around observable behavior. Keep unit tests isolated and use integration/E2E tests where boundaries matter. Never weaken assertions to make an implementation pass. The compiled runtime smoke test must exercise `dist/src/main.js`.

## Formatting and linting

Use the existing Prettier and ESLint configuration:

```bash
npm run format
npm run format:check
npm run lint
npm run typecheck
```

## Comments

Prefer expressive code over comments. Comments should explain non-obvious constraints or security decisions, not restate the code.

## Minimal-change rule

Do not add a dependency, abstraction, wrapper, base class, or utility unless it solves a real problem in the current implementation. Keep refactors local to the requested architectural boundary.
