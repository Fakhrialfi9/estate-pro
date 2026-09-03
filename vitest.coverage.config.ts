import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    maxWorkers: 1,
    minWorkers: 1,
    sequence: {
      concurrent: false,
    },
    projects: [
      {
        test: {
          name: 'unit',
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
        },
      },
      {
        test: {
          name: 'integration',
          globals: true,
          environment: 'node',
          include: ['test/integration/**/*.spec.ts'],
          setupFiles: ['./test/integration/setup.ts'],
          testTimeout: 15_000,
          hookTimeout: 15_000,
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'e2e',
          globals: true,
          environment: 'node',
          include: ['test/e2e/**/*.spec.ts'],
          setupFiles: ['./test/e2e/environment.ts'],
          globalSetup: ['./test/e2e/setup.ts'],
          testTimeout: 30_000,
          hookTimeout: 30_000,
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'security',
          globals: true,
          environment: 'node',
          include: ['test/security/**/*.spec.ts'],
          testTimeout: 30_000,
          hookTimeout: 30_000,
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/common/**/*.ts',
        'src/modules/**/domain/**/*.ts',
        'src/modules/**/application/**/*.ts',
        'src/modules/**/security/**/*.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 60,
      },
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        'test/**',
        '**/*.d.ts',
        '**/generated/**',
        '**/*.config.ts',
        'src/config/**',
        'src/**/presentation/**',
        'src/**/infrastructure/**',
        'src/**/application/dto/**',
        'src/**/application/serializers/**',
      ],
    },
  },
});
