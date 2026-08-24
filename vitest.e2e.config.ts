import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/e2e/**/*.spec.ts'],
    setupFiles: ['./test/e2e/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
