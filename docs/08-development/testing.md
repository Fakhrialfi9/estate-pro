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
| Coverage | `npm run test:coverage` | Default Vitest suite with V8 coverage |
| E2E coverage | `npm run test:coverage:e2e` | E2E suite with coverage |
| All named suites | `npm run test:all` | Unit + integration + E2E + security |

## Supporting checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm run check:architecture
npm test
npm run test:coverage
npm run test:integration
npm run test:e2e
npm run test:security
npm run build
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

## Database tests

Integration/E2E tests that exercise persistence require a valid test database configuration. Use isolated test data and never point automated tests at production.

## Architecture regression tests

`npm run check:architecture` performs a dependency-boundary static check without introducing an additional architecture-analysis dependency. It now validates the source import graph for circular dependencies and illegal cross-module internal imports, then verifies the high-risk forbidden imports for domain, common, Prisma, presentation, and application boundaries.

The architecture checker intentionally fails on `forwardRef()` only when such a cycle-hiding pattern is present in the source graph; architectural cycles must be removed rather than masked.

## Coverage

Coverage is produced by `@vitest/coverage-v8`. Use `npm run test:coverage` for the default suite and `npm run test:coverage:e2e` for E2E coverage.

## No test cheating

Do not use `.skip`, `.only`, `.todo`, disabled checks, deleted assertions, or broad mocks merely to obtain a passing suite. Fix the underlying implementation or test setup problem.
