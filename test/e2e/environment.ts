import {
  resolveTestDatabaseUrl,
  synchronizeDatabaseEnvironment,
} from '../database/setup.js';

const setDefault = (key: string, value: string): void => {
  if (process.env[key] === undefined) process.env[key] = value;
};

export function configureTestEnvironment(): void {
  setDefault('NODE_ENV', 'test');
  setDefault('APP_NAME', 'estate-pro-e2e');
  setDefault('APP_VERSION', '0.0.1');
  setDefault('APP_HOST', '127.0.0.1');
  setDefault('APP_PORT', '3001');
  setDefault('API_PREFIX', 'api');
  setDefault('API_VERSION', 'v1');
  setDefault('SWAGGER_ENABLED', 'true');
  setDefault('DATABASE_POOL_CONNECTION_LIMIT', '2');
  setDefault('DATABASE_CONNECT_TIMEOUT_MS', '5000');
  setDefault('DATABASE_ACQUIRE_TIMEOUT_MS', '10000');
  setDefault('DATABASE_POOL_IDLE_TIMEOUT_SEC', '30');
  setDefault('JWT_SECRET', 'test-only-secret-that-is-at-least-32-chars');
  setDefault(
    'TWO_FACTOR_ENCRYPTION_KEY',
    'test-only-two-factor-encryption-key-at-least-32-chars',
  );
  process.env.AUTH_LOGIN_RATE_LIMIT = '100';
  process.env.AUTH_LOGIN_RATE_LIMIT_TTL_MS = '60000';
  process.env.AUTH_REFRESH_RATE_LIMIT = '10';
  process.env.AUTH_REFRESH_RATE_LIMIT_TTL_MS = '60000';
  setDefault('SECURITY_RATE_LIMIT_MAX', '1000');
  process.env.SECURITY_TRUST_PROXY = 'loopback';
  process.env.OTEL_TRACING_ENABLED = 'false';
  process.env.OTEL_METRICS_ENABLED = 'false';
  process.env.OTEL_TRACES_EXPORTER = 'none';
  process.env.OTEL_METRICS_EXPORTER = 'none';
  setDefault('LOG_LEVEL', 'debug');

  synchronizeDatabaseEnvironment(resolveTestDatabaseUrl());
}

configureTestEnvironment();
