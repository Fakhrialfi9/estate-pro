# Development Rules

This document is the guardrail for developers and AI agents working on Estate Pro.

## Git policy

- Work directly on `main`.
- **DO NOT CREATE BRANCH OTHER THAN MAIN.**
- Do not create feature, fix, chore, temporary, AI/Codex branches, or worktrees.
- Do not create pull requests for this workflow.
- Do not force-push.
- Do not use destructive reset operations to discard work.
- Inspect existing changes before editing and never overwrite unrelated user work.
- Commit only changes belonging to the requested scope.

## Architecture rules

- Keep presentation, application, domain, and infrastructure responsibilities separate.
- Domain must not import Prisma, NestJS infrastructure, MariaDB, Pino, or OpenTelemetry.
- Application/use-case code must not import Prisma or SQL details.
- Controllers handle transport concerns, validation, use-case invocation, and response mapping only.
- Business rules belong in domain objects or application policies according to responsibility.
- Repositories are abstractions at the inner boundary; concrete persistence adapters belong in infrastructure.
- Common code is generic and reusable; it must not become a business-domain dumping ground.
- Cross-module dependencies must be explicit, minimal, and through public contracts.
- Never import another module's internal repository/domain/infrastructure file.
- Never use `forwardRef()` to conceal an architectural cycle.

## Database rules

- Prisma is an infrastructure detail.
- Do not expose Prisma model/client types through domain or application contracts.
- Database ownership belongs to the infrastructure boundary.
- Use migrations and Prisma commands already declared in `package.json`.

## Security rules

- Never commit real secrets.
- Do not weaken validation to make tests pass.
- Keep sensitive log redaction intact.
- Do not log credentials, tokens, passwords, encryption keys, or database secrets.
- Production secrets must come from an environment/secret manager.

## TypeScript and code quality

- Keep strict typing enabled.
- Prefer explicit, narrow types over `any`.
- Use existing ESM import conventions, including `.js` for local TypeScript imports where required by the project.
- Keep modules small and cohesive.
- Avoid speculative abstractions and generic wrappers.
- Remove dead code instead of leaving placeholders.

## Testing

- Run the smallest relevant test set while iterating.
- Before completion, run the repository's available lint, formatting, typecheck, unit, integration, E2E, security, coverage, build, and Prisma validation commands.
- Never use `.skip`, `.only`, `.todo`, disabled lint/type checks, deleted tests, or weakened assertions to obtain a green result.
- Fix root causes.

## Environment

- Use `.env.example` as a shape/template only.
- Never copy real credentials into documentation.
- Keep environment documentation synchronized with actual consumers in `src/config` and bootstrap/infrastructure code.

## Documentation

Documentation is a contract. Do not document architecture, endpoints, modules, scripts, or commands that do not exist. Update documentation in the same change when implementation changes its documented contract.

## Scripts

- Shell scripts must use safe quoting and fail fast.
- Destructive scripts use explicit whitelists of generated/development artifacts.
- Never delete source, configuration, migrations, documentation, `.git`, or lockfiles as a side effect of cleanup.
- Avoid absolute machine-specific paths.

## AI slop prevention

AI agents must prefer the minimum correct change. Do not add interfaces, base classes, wrappers, dependencies, architecture diagrams, tests, or documents without an actual architectural or maintenance need. Do not create placeholder code solely to satisfy a checklist.
