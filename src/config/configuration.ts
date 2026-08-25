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

export const configuration = [appConfig, apiConfig, authConfig, corsConfig, databaseConfig, loggingConfig, observabilityConfig, rateLimitConfig, securityConfig];

const environmentSecret = Joi.string().trim().min(32).required().invalid('changeme','change-me','your-secret','your-secret-here','<production-secret>','<production-jwt-secret>','<development-jwt-secret-min-32-chars>','<set-in-secret-manager>','replace-with-a-random-32-plus-character-secret');
const optionalSecret = Joi.string().trim().min(32).invalid('changeme','change-me','your-secret','your-secret-here','<production-secret>','<production-2fa-key-min-32-chars>');
const traceExporter = Joi.string().trim().valid('otlp', 'zipkin', 'none');
const metricsExporter = Joi.string().trim().valid('otlp', 'prometheus', 'console', 'none');

export const configurationValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'staging', 'production').default('development'),
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
  DATABASE_POOL_CONNECTION_LIMIT: Joi.number().integer().min(1).max(1000).default(10),
  DATABASE_CONNECT_TIMEOUT_MS: Joi.number().integer().min(1).default(5000),
  DATABASE_ACQUIRE_TIMEOUT_MS: Joi.number().integer().min(1).default(10000),
  DATABASE_POOL_IDLE_TIMEOUT_SEC: Joi.number().integer().min(1).default(300),
  JWT_SECRET: Joi.alternatives().conditional('NODE_ENV', { is: Joi.valid('staging', 'production'), then: environmentSecret, otherwise: Joi.string().trim().min(32).required().invalid('changeme','change-me','your-secret','your-secret-here','<development-jwt-secret-min-32-chars>','<set-in-secret-manager>','replace-with-a-random-32-plus-character-secret') }),
  JWT_EXPIRES_IN: Joi.string().trim().min(1).default('15m'),
  JWT_ISSUER: Joi.string().trim().min(1).max(200).default('estate-pro-api'),
  JWT_AUDIENCE: Joi.string().trim().min(1).max(200).default('estate-pro-client'),
  JWT_ALGORITHM: Joi.string().valid('HS256', 'HS384', 'HS512').default('HS256'),
  TWO_FACTOR_ENCRYPTION_KEY: Joi.alternatives().conditional('NODE_ENV', { is: Joi.valid('staging', 'production'), then: optionalSecret.required(), otherwise: Joi.string().min(32).optional() }),
  TWO_FACTOR_CHALLENGE_TTL_MS: Joi.number().integer().min(30000).max(900000).default(300000),
  TWO_FACTOR_CHALLENGE_MAX_ATTEMPTS: Joi.number().integer().min(3).max(10).default(5),
  TWO_FACTOR_OTP_LOCKOUT_THRESHOLD: Joi.number().integer().min(2).max(20).default(5),
  TWO_FACTOR_OTP_LOCKOUT_DURATION_MS: Joi.number().integer().min(60000).max(86400000).default(900000),
  TWO_FACTOR_RECOVERY_CODE_COUNT: Joi.number().integer().min(5).max(20).default(10),
  AUTH_LOGIN_RATE_LIMIT: Joi.number().integer().min(1).max(100).default(5),
  AUTH_LOGIN_RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).max(3600000).default(60000),
  AUTH_LOCKOUT_THRESHOLD: Joi.number().integer().min(2).max(100).default(5),
  AUTH_LOCKOUT_WINDOW_MS: Joi.number().integer().min(1000).max(86400000).default(900000),
  AUTH_LOCKOUT_DURATION_MS: Joi.number().integer().min(1000).max(86400000).default(900000),
  AUTH_ARGON2_MEMORY_COST: Joi.number().integer().min(19456).max(1048576).default(19456),
  AUTH_ARGON2_TIME_COST: Joi.number().integer().min(2).max(10).default(2),
  AUTH_ARGON2_PARALLELISM: Joi.number().integer().min(1).max(4).default(1),
  SECURITY_CORS_ORIGINS: Joi.string().trim().when('NODE_ENV', { is: Joi.valid('staging', 'production'), then: Joi.required(), otherwise: Joi.string().trim().default('http://localhost:3000') }),
  SECURITY_RATE_LIMIT_TTL: Joi.number().integer().min(1000).max(3600000).default(60000),
  SECURITY_RATE_LIMIT_MAX: Joi.number().integer().min(1).max(10000).default(100),
  SECURITY_BODY_LIMIT: Joi.string().trim().min(1).default('1mb'),
  SECURITY_COMPRESSION_THRESHOLD: Joi.string().trim().min(1).default('1kb'),
  SECURITY_GRPC_MAX_MESSAGE_BYTES: Joi.number().integer().min(1024).default(1048576),
  SECURITY_TRUST_PROXY: Joi.string().trim().min(1).invalid('true', 'false'),
  SECURITY_CSP_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  SECURITY_HSTS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  LOG_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  LOG_LEVEL: Joi.string().valid('fatal','error','warn','info','debug','trace','silent').default('info'),
  OTEL_SERVICE_NAME: Joi.string().trim().min(1).max(100),
  OTEL_TRACING_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  OTEL_TRACES_EXPORTER: traceExporter.default('otlp'),
  OTEL_TRACES_SAMPLER: Joi.string().valid('always_on','always_off','traceidratio','parentbased_traceidratio').default('parentbased_traceidratio'),
  OTEL_TRACES_SAMPLER_ARG: Joi.number().min(0).max(1).default(0.1),
  OTEL_METRICS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  OTEL_METRICS_EXPORTER: metricsExporter.default('otlp'),
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().optional(),
  OTEL_METRIC_EXPORT_INTERVAL: Joi.number().integer().min(1000).default(60000),
});
