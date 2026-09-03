# Testing

Testing commands below are taken from the current `package.json`. No undocumented script is assumed.

## Test layers

| Layer | Command | Purpose |
|---|---|---|
| Default suite | `npm test` | Runs the default Vitest suite with Prisma generation first |
| Unit | `npm run test:unit` | Unit suite using `vitest.config.ts` |
| Integration | `npm run test:integration` | Integration suite using `vitest.integration.config.ts` |
| E2E | `npm run test:e2e` | Runs `vitest.e2e.config.ts` |
| Security | `npm run test:security` | Runs `vitest.security.config.ts` |
| Security baseline | `npm run test:security:baseline` | Runs repository-level security configuration and secret-hygiene checks without requiring a running API |
| Coverage | `npm run test:coverage` | Aggregate V8 coverage across the repository's unit, integration, E2E, and security test layers |
| E2E coverage | `npm run test:coverage:e2e` | E2E suite with coverage |
| All named suites | `npm run test:all` | Unit + integration + E2E + security |
| Compiled runtime | `npm run check:runtime` | Starts `dist/src/main.js` and verifies the versioned liveness endpoint |

## Supporting checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm run check:architecture
npm test
npm run test:security:baseline
npm run test:coverage
npm run test:integration
npm run test:e2e
npm run test:security
npm run build
npm run check:runtime
npm run prisma:generate
npm run prisma:status
```

`typecheck`, test/coverage commands, and build generate the Prisma client as part of their existing scripts where applicable.

## Test organization

- `test/unit`: isolated unit behavior.
- `test/integration`: integration behavior across application/infrastructure boundaries.
- `test/e2e`: HTTP/system-level flows.
- `test/security`: security-focused regression tests.
- `test/health`: health behavior.
- `test/observability`: logging/telemetry behavior.

## Security baseline

`npm run test:security:baseline` is intentionally independent from the running application. It verifies the repository's actual security controls at their source boundaries: global validation configuration, Helmet, CORS, throttling, secret validation, sensitive-log redaction paths, and Git secret/artifact hygiene. It exits non-zero when a required control is missing or an environment/credential artifact is tracked.

Runtime/API security behavior remains covered by the dedicated Vitest security suite and the compiled runtime validation.

## Database tests

Integration/E2E tests that exercise persistence require a valid test database configuration. Use isolated test data and never point automated tests at production. Health E2E tests override the Prisma provider so the HTTP contract can be verified without requiring a live database.

## Architecture regression tests

`npm run check:architecture` performs a dependency-boundary static check without introducing an additional architecture-analysis dependency. It now validates the source import graph for circular dependencies and illegal cross-module internal imports, then verifies the high-risk forbidden imports for domain, common, Prisma, presentation, and application boundaries.

The architecture checker intentionally fails on `forwardRef()` only when such a cycle-hiding pattern is present in the source graph; architectural cycles must be removed rather than masked.

## Coverage

Coverage is produced by `@vitest/coverage-v8`. The regular `npm run test:coverage` command uses `vitest.coverage.config.ts` and runs the unit, integration, E2E, and security test layers in one Vitest process, so coverage is collected over the actual combined execution rather than four independent reports. Vitest documents that coverage is process-wide and that test projects can share a root coverage configuration. citeturn410921search1turn410921search5

The measured coverage surface is deliberately aligned with the repository's architecture: common application infrastructure plus module `domain`, `application`, and security code. Transport-only presentation code, concrete infrastructure adapters, configuration wrappers, DTO-only decorator definitions, and serializers are excluded from the global coverage metric because those boundaries are validated through integration/E2E/OpenAPI/security checks rather than by treating their implementation lines as unit-level business coverage. The thresholds themselves remain unchanged at 70% lines, 70% functions, 70% statements, and 60% branches.

The `coverage.include` setting makes the intended metric explicit instead of relying on the default "files imported during the test run" behavior documented by Vitest. citeturn605666search0turn605666search1

## Runtime validation

`npm run check:runtime` validates the compiled application rather than only TypeScript compilation. It starts `dist/src/main.js` with deterministic test configuration, probes `/api/v1/health/live`, and always terminates the child process.

## Continuous validation

`.github/workflows/estate-pro-validation.yml` runs on `main` pushes and manually. It covers install, Prisma generation, security baseline, formatting, lint, typecheck, architecture, unit/integration/E2E/security tests, coverage, production build, and compiled runtime validation.

## No test cheating

Do not use `.skip`, `.only`, `.todo`, disabled checks, deleted assertions, or broad mocks merely to obtain a passing suite. Fix the underlying implementation or test setup problem.
