# Estate Pro — Technical Baseline

Baseline revision: `60a1e588f71fee21c406a7f48ed5c32481911d09`
Branch: `main`

## Architecture

The backend is a NestJS/TypeScript application using a module-oriented structure with domain/application/infrastructure/presentation separation in major bounded areas. Prisma is kept under infrastructure and the generated client is used by persistence adapters.

Existing cross-cutting concerns include authentication, authorization/RBAC, audit logging, structured logging, OpenTelemetry, validation, health checks, and architecture validation scripts.

## Existing domain areas

Current repository modules include users, auth, permissions, roles, property, content, CRM, sales, agent management, property matching, automation, analytics, audit, system, and health.

Property already contains SEO persistence (`PropertySeo`). Content already contains polymorphic SEO persistence (`ContentSeo`) and public content read paths that compose SEO data. This means SEO implementation must consolidate existing behavior rather than introduce duplicate property/content SEO ownership.

## Database

Prisma is configured with `prisma/schema` and `prisma/migrations`. `DATABASE_URL` is the canonical Prisma datasource value. Existing migration history contains a baseline followed by incremental migrations for authentication, authorization, property, and supporting domains.

## CI/CD baseline

The validation workflow is intended to be immutable and validation-only. It must not commit or push source changes. CI validates dependency installation, Prisma schema/migrations, security baseline, formatting, lint, typecheck, architecture, tests, OpenAPI, build, runtime, Docker, recovery/migration rehearsal, and repository cleanliness.

## Known constraints / blockers

1. GitHub branch-protection/ruleset settings are repository-hosted controls and are not represented as source files. The current `main` branch protection state must be configured and verified in GitHub settings before release certification.
2. Production deployment, production secrets, production database backup/recovery, and post-release monitoring cannot be certified from repository source alone; they require the actual deployment environment.
3. SEO must reuse the existing `PropertySeo` and `ContentSeo` persistence instead of creating a second source of truth.
4. Existing object-level property authorization is centralized in `PropertyAccessGuard`; any SEO resource authorization must reuse that policy rather than creating a parallel ACL.
