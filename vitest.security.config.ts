import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'test/security/**/*.spec.ts',
      'test/e2e/authentication.e2e.spec.ts',
      'test/e2e/authorization.e2e.spec.ts',
      'test/e2e/property-authorization.e2e.spec.ts',
      'test/e2e/refresh-token-lifecycle.e2e.spec.ts',
      'test/e2e/two-factor.e2e.spec.ts',
    ],
    setupFiles: ['./test/e2e/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
