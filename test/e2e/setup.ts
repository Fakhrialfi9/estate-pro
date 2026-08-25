import { loadEnvFile } from 'node:process';
import { prepareTestDatabase } from '../database/setup.js';

const loadProjectEnvironment = (): void => {
  try {
    loadEnvFile('.env');
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    ) {
      throw error;
    }
  }
};

const setDefault = (key: string, value: string): void => {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
};

const synchronizeDatabaseEnvironment = (): void => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return;
  }

  const url = new URL(databaseUrl);

  process.env.DATABASE_HOST = url.hostname;
  process.env.DATABASE_PORT = url.port || '3306';
  process.env.DATABASE_NAME = decodeURIComponent(url.pathname.slice(1));
  process.env.DATABASE_USER = decodeURIComponent(url.username);
  process.env.DATABASE_PASSWORD = decodeURIComponent(url.password);
};

loadProjectEnvironment();

setDefault('NODE_ENV', 'test');
setDefault('APP_NAME', 'estate-pro-e2e');
setDefault('APP_VERSION', '0.0.1');
setDefault('APP_HOST', '127.0.0.1');
setDefault('APP_PORT', '3001');
setDefault('API_PREFIX', 'api');
setDefault('API_VERSION', 'v1');

// DATABASE_URL is the canonical E2E database configuration. Keep the
// split DATABASE_* variables synchronized with it so Prisma never connects
// to a different host, port, database, or credential set.
synchronizeDatabaseEnvironment();

setDefault('DATABASE_POOL_CONNECTION_LIMIT', '2');
setDefault('DATABASE_CONNECT_TIMEOUT_MS', '5000');
setDefault('DATABASE_ACQUIRE_TIMEOUT_MS', '10000');
setDefault('DATABASE_POOL_IDLE_TIMEOUT_SEC', '30');

setDefault('JWT_SECRET', 'test-only-secret-that-is-at-least-32-chars');
setDefault('SECURITY_CORS_ORIGINS', 'http://localhost:3000');
setDefault('SECURITY_RATE_LIMIT_MAX', '1000');
setDefault('OTEL_TRACING_ENABLED', 'false');
setDefault('OTEL_METRICS_ENABLED', 'false');
setDefault('LOG_LEVEL', 'debug');

prepareTestDatabase();
