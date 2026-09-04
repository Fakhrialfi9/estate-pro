import { describe, expect, it } from 'vitest';

import { configurationValidationSchema } from '../../src/config/configuration.js';

describe('production configuration', () => {
  it('accepts a sanitized production-like environment with a strong secret', () => {
    const result = configurationValidationSchema.validate({
      NODE_ENV: 'production',
      APP_NAME: 'estate-pro-api',
      APP_VERSION: '0.0.1',
      APP_HOST: '127.0.0.1',
      APP_PORT: 3000,
      APP_PUBLIC_URL: 'https://api.example.test',
      API_PREFIX: 'api',
      API_VERSION: 'v1',
      DATABASE_URL: 'mysql://app:password@127.0.0.1:3306/estate_pro',
      JWT_SECRET: 'production-only-secret-that-is-long-and-random-123456',
      TWO_FACTOR_ENCRYPTION_KEY:
        'production-two-factor-key-that-is-long-and-random-123456',
      SECURITY_CORS_ORIGINS: 'https://app.example.test',
      SECURITY_CSP_ENABLED: true,
      SECURITY_HSTS_ENABLED: true,
      OTEL_TRACES_SAMPLER_ARG: 0.1,
    });

    expect(result.error).toBeUndefined();
  });
});
