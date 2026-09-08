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
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 90,
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
