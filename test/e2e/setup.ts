const setDefault = (key: string, value: string): void => {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
};

setDefault('NODE_ENV', 'test');
setDefault('APP_NAME', 'estate-pro-e2e');
setDefault('APP_VERSION', '0.0.1');
setDefault('APP_HOST', '127.0.0.1');
setDefault('APP_PORT', '3001');
setDefault('API_PREFIX', 'api');
setDefault('API_VERSION', 'v1');
setDefault(
  'DATABASE_URL',
  'mysql://test:test-password@127.0.0.1:3306/estate_pro_test',
);
setDefault('DATABASE_HOST', '127.0.0.1');
setDefault('DATABASE_PORT', '3306');
setDefault('DATABASE_NAME', 'estate_pro_test');
setDefault('DATABASE_USER', 'test');
setDefault('DATABASE_PASSWORD', 'test-password');
setDefault('DATABASE_POOL_CONNECTION_LIMIT', '2');
setDefault('DATABASE_CONNECT_TIMEOUT_MS', '10000');
setDefault('DATABASE_ACQUIRE_TIMEOUT_MS', '30000');
setDefault('DATABASE_POOL_IDLE_TIMEOUT_SEC', '30');
setDefault('JWT_SECRET', 'test-only-secret-that-is-at-least-32-chars');
setDefault('SECURITY_CORS_ORIGINS', 'http://localhost:3000');
setDefault('SECURITY_RATE_LIMIT_MAX', '1000');
setDefault('OTEL_TRACING_ENABLED', 'false');
setDefault('OTEL_METRICS_ENABLED', 'false');
setDefault('LOG_LEVEL', 'debug');
