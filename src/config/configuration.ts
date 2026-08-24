import Joi from 'joi';

import apiConfig from './api.config.js';
import appConfig from './app.config.js';
import authConfig from './auth.config.js';
import corsConfig from './cors.config.js';
import databaseConfig from './database.config.js';
import loggingConfig from './logging.config.js';
import observabilityConfig from './observability.config.js';
import rateLimitConfig from './rate-limit.config.js';
import securityConfig from './security.config.js';

export const configuration = [
  appConfig,
  apiConfig,
  authConfig,
  corsConfig,
  databaseConfig,
  loggingConfig,
  observabilityConfig,
  rateLimitConfig,
  securityConfig,
];

export const configurationValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  APP_NAME: Joi.string().trim().min(1).max(100).default('estate-pro-api'),
  APP_VERSION: Joi.string().trim().min(1).max(50),
  APP_HOST: Joi.string().trim().min(1).default('0.0.0.0'),
  APP_PORT: Joi.number().integer().min(1).max(65535).default(3000),
  API_PREFIX: Joi.string().trim().min(1).default('api'),
  API_VERSION: Joi.string().trim().min(1).default('v1'),

  DATABASE_URL: Joi.string().uri({ scheme: ['mysql'] }).required(),
  DATABASE_HOST: Joi.string().trim().min(1).required(),
  DATABASE_PORT: Joi.number().integer().min(1).max(65535).default(3306),
  DATABASE_NAME: Joi.string().trim().min(1).required(),
  DATABASE_USER: Joi.string().trim().min(1).required(),
  DATABASE_PASSWORD: Joi.string().min(1).required(),
  DATABASE_POOL_CONNECTION_LIMIT: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(10),
  DATABASE_CONNECT_TIMEOUT_MS: Joi.number().integer().min(1).default(5000),
  DATABASE_ACQUIRE_TIMEOUT_MS: Joi.number().integer().min(1).default(10000),
  DATABASE_POOL_IDLE_TIMEOUT_SEC: Joi.number().integer().min(1).default(300),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().trim().min(1).default('15m'),
  JWT_ISSUER: Joi.string().trim().min(1).max(200).default('estate-pro-api'),
  JWT_AUDIENCE: Joi.string().trim().min(1).max(200).default('estate-pro-client'),
  JWT_ALGORITHM: Joi.string()
    .valid('HS256', 'HS384', 'HS512')
    .default('HS256'),
  TWO_FACTOR_ENCRYPTION_KEY: Joi.string().min(32),

  SECURITY_CORS_ORIGINS: Joi.string()
    .trim()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.default('http://localhost:3000'),
    }),
  SECURITY_RATE_LIMIT_TTL: Joi.number().integer().min(1).default(60000),
  SECURITY_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(100),
  SECURITY_BODY_LIMIT: Joi.string().trim().min(1).default('1mb'),
  SECURITY_GRPC_MAX_MESSAGE_BYTES: Joi.number()
    .integer()
    .min(1024)
    .default(1048576),
  SECURITY_TRUST_PROXY: Joi.string().trim().min(1),

  LOG_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),

  OTEL_SERVICE_NAME: Joi.string().trim().min(1).default('estate-pro-api'),
  OTEL_TRACING_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  OTEL_TRACES_SAMPLER_ARG: Joi.number().min(0).max(1).default(0.1),
  OTEL_METRICS_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  OTEL_METRIC_EXPORT_INTERVAL: Joi.number()
    .integer()
    .min(1000)
    .default(60000),
});
