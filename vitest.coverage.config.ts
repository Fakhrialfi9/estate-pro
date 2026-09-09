import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/unit/**/*.spec.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'test/e2e/**',
      'test/integration/**',
      'test/grpc/**',
      'test/security/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 40,
        functions: 40,
        statements: 40,
        branches: 40,
      },
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        'test/**',
        '**/*.d.ts',
        '**/generated/**',
      ],
    },
  },
});
