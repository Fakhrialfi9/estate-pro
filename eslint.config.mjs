import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const typescriptFiles = ['src/**/*.ts'];
const testTypescriptFiles = ['test/**/*.ts'];

const typeCheckedConfigs = tseslint.configs.recommendedTypeChecked.map(
  (config) => ({
    ...config,
    files: typescriptFiles,
  }),
);

const baseTypeScriptRules = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/consistent-type-imports': [
    'error',
    {
      prefer: 'type-imports',
      fixStyle: 'separate-type-imports',
    },
  ],
  'prettier/prettier': 'error',
};

const vitestGlobals = {
  afterAll: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  describe: 'readonly',
  expect: 'readonly',
  it: 'readonly',
  test: 'readonly',
  vi: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'prisma/generated/**',
      'prisma/migrations/**',
      'prisma/seeds/**',
      'vitest.config.ts',
      'vitest.e2e.config.ts',
      'tsconfig.eslint.json',
    ],
  },

  eslint.configs.recommended,

  ...typeCheckedConfigs,

  {
    files: typescriptFiles,

    languageOptions: {
      globals: {
        ...globals.node,
        ...vitestGlobals,
      },

      parserOptions: {
        projectService: true,
      },
    },

    plugins: {
      '@typescript-eslint': tseslint.plugin,
      prettier: prettierPlugin,
    },

    rules: {
      ...baseTypeScriptRules,
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'prettier/prettier': 'error',
    },
  },

  {
    files: testTypescriptFiles,

    languageOptions: {
      parser: tseslint.parser,

      globals: {
        ...globals.node,
        ...vitestGlobals,
      },

      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },

    plugins: {
      '@typescript-eslint': tseslint.plugin,
      prettier: prettierPlugin,
    },

    rules: baseTypeScriptRules,
  },

  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  prettierConfig,
);
