import { describe, expect, it } from 'vitest';

import { configurationValidationSchema } from '../../src/config/configuration.js';

const validEnvironment = {
  NODE_ENV: 'test',
  APP_NAME: 'estate-pro-test',
  APP_VERSION: '0.0.1',
  APP_HOST: '127.0.0.1',
  APP_PORT: 3001,
  API_PREFIX: 'api',
  API_VERSION: 'v1',
  DATABASE_URL: 'mysql://test:test@127.0.0.1:3306/estate_pro_test',
  DATABASE_HOST: '127.0.0.1',
  DATABASE_PORT: 3306,
  DATABASE_NAME: 'estate_pro_test',
  DATABASE_USER: 'test',
  DATABASE_PASSWORD: 'test-password',
  JWT_SECRET: 'test-only-secret-that-is-at-least-32-chars',
  SECURITY_CORS_ORIGINS: 'http://localhost:3000',
  OTEL_TRACES_SAMPLER_ARG: 0.1,
};

describe('configurationValidationSchema', () => {
  it('accepts a valid test environment', () => {
    const result = configurationValidationSchema.validate(validEnvironment);

    expect(result.error).toBeUndefined();
  });

  it('rejects missing required environment values', () => {
    const { JWT_SECRET: _jwtSecret, ...missingSecret } = validEnvironment;
    const result = configurationValidationSchema.validate(missingSecret);

    expect(result.error).toBeDefined();
  });

  it('rejects an invalid port', () => {
    const result = configurationValidationSchema.validate({
      ...validEnvironment,
      APP_PORT: 0,
    });

    expect(result.error).toBeDefined();
  });

  it('rejects weak production JWT secrets', () => {
    const result = configurationValidationSchema.validate({
      ...validEnvironment,
      NODE_ENV: 'production',
      JWT_SECRET: 'changeme',
    });

    expect(result.error).toBeDefined();
  });

  it('rejects an out-of-range telemetry sampling ratio', () => {
    const result = configurationValidationSchema.validate({
      ...validEnvironment,
      OTEL_TRACES_SAMPLER_ARG: 1.01,
    });

    expect(result.error).toBeDefined();
  });
});
