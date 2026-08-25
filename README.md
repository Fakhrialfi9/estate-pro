# Estate Pro API

Estate Pro is a NestJS/TypeScript backend for property management and sales workflows. The application currently focuses on the Phase 1 authentication, authorization, user management, credentials, sessions, 2FA, audit logging, security, and observability foundation.

## Stack

- Node.js 22.x
- NestJS 11
- TypeScript 5
- Prisma 7 with MariaDB/MySQL-compatible database
- Argon2 password hashing
- JWT authentication
- TOTP-based 2FA and recovery codes
- Vitest + Supertest
- ESLint + Prettier

## Setup

Use the repository's pinned npm version and install dependencies:

```bash
npm install --global npm@11.18.0
npm ci
```

Configure a valid database and security environment before starting the API. Do not commit `.env` files, credentials, JWT secrets, encryption keys, or database dumps.

## Prisma

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:status
```

`prisma/schema` is the database contract. Production and CI database changes must be delivered through committed Prisma migrations; do not use database reset as a deployment mechanism.

The Phase 1 migration history contains a baseline migration followed by the credential/password-reset, session-secret, 2FA, and audit-logging migrations. A fresh MariaDB database must be able to execute the complete migration chain with `prisma migrate deploy`, followed by `prisma migrate status` reporting an up-to-date schema.

## Run the API

```bash
# development
npm run start:dev

# production build
npm run build

# production runtime
npm run start:prod
```

The API uses the `/api/v1` prefix. The runtime validation script starts the compiled application with production-style configuration and verifies the liveness endpoint:

```text
GET /api/v1/health/live
```

```bash
npm run check:runtime
```

## Validation

Run the same checks used by the Phase 1 CI gate:

```bash
npm run prisma:generate
npm run prisma:deploy
npm run prisma:status
npm run test:security:baseline
npm run format:check
npm run lint
npm run typecheck
npm run check:architecture
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:security
npm run test:coverage
npm run build
npm run check:runtime
```

For a combined local health check, the repository also provides:

```bash
npm run check:health
```

## Security baseline

The project enforces global validation, Helmet, explicit CORS, throttling, JWT secret validation, sensitive logging protection, and ignored credential artifacts. Security-sensitive values such as passwords, password hashes, JWTs, tokens, cookies, sessions, TOTP secrets, recovery codes, encryption keys, API keys, and credentials must never be written to application or audit logs.

Password credentials use Argon2. Session secrets are stored as hashes. TOTP secrets are encrypted at rest. Recovery codes are stored as hashes and are single-use. Authentication and security events carry request/correlation context where the current request context is available.

## Architecture

The codebase follows a modular NestJS design with domain/application/infrastructure/controller boundaries. Security authorization is default-deny unless a route is explicitly public or has the required role/permission metadata.

Do not bypass module boundaries by accessing infrastructure or database state directly from unrelated domains. Extend the existing design instead of introducing Phase 2+ domain implementation into the Phase 1 codebase.

## CI

GitHub Actions validates the `main` branch with a read-only repository token. The workflow does not auto-commit formatting or generated artifacts.

The Phase 1 gate validates:

1. Prisma generation and migration deployment/status.
2. Security baseline, formatting, lint, and typecheck.
3. Architecture, unit, integration, E2E, and security suites.
4. Coverage, production build, and compiled runtime/liveness validation.

The working tree is expected to remain clean after validation; generated output belongs in ignored build/coverage directories and must not be committed.

## Repository conventions

- Work on `main` for the current Phase 1 workflow.
- Keep changes production-ready and minimal.
- Do not weaken tests or security controls to obtain a green build.
- Do not commit secrets, credentials, database dumps, temporary files, or generated artifacts that are not part of the source contract.
