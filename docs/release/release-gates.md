# Release Gate Matrix

Estate Pro release qualification is validation-first and immutable.

## Required order

1. Dependency install (`npm ci`).
2. Prisma schema generation/validation/status.
3. Fresh migration and seed validation.
4. Security baseline and secret scan.
5. Formatting, lint, typecheck, and architecture checks.
6. Unit and integration tests.
7. E2E and security E2E tests.
8. OpenAPI contract and specification validation.
9. Coverage and aggregate test suite.
10. Production build and compiled runtime checks.
11. Fresh-install reproducibility.
12. Docker build and container smoke validation.
13. Migration/recovery rehearsal.
14. Repository immutability check.
15. Final architecture/configuration/authentication/authorization/SEO/database/resilience/observability/performance review.
16. Production readiness and deployment checks in the real target environment.

## Gate rules

A release gate is PASS only when its required command/test/evidence succeeds on the exact revision being released. Passing compilation alone is insufficient.

CI has read-only repository contents permission and must not mutate the source revision. Any generated artifact used for validation must be outside the tracked source tree or be ignored by the repository.

Production-only gates require external evidence for branch protection/rulesets, deployment configuration, secret manager values, live database state, backup/restore execution, runtime health, and post-release monitoring.
