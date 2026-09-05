import Joi from 'joi';
import apiConfig from './api.config.js';
import appConfig from './app.config.js';
import auditConfig from './audit.config.js';
import authConfig from './auth.config.js';
import automationConfig from './automation.config.js';
import corsConfig from './cors.config.js';
import databaseConfig from './database.config.js';
import loggingConfig from './logging.config.js';
import observabilityConfig from './observability.config.js';
import rateLimitConfig from './rate-limit.config.js';
import securityConfig from './security.config.js';
import systemConfig from './system.config.js';

export const configuration = [
  appConfig,
  apiConfig,
  auditConfig,
  authConfig,
  automationConfig,
  corsConfig,
  databaseConfig,
  loggingConfig,
  observabilityConfig,
  rateLimitConfig,
  securityConfig,
  systemConfig,
];

const environmentSecret = Joi.string()
  .trim()
  .min(32)
  .required()
  .invalid(
    'changeme',
    'change-me',
    'your-secret',
    'your-secret-here',
    '<production-secret>',
    '<production-jwt-secret>',
    '<development-jwt-secret-min-32-chars>',
    '<set-in-secret-manager>',
    'replace-with-a-random-32-plus-character-secret',
  );
const optionalSecret = Joi.string()
  .trim()
  .min(32)
  .invalid(
    'changeme',
    'change-me',
    'your-secret',
    'your-secret-here',
    '<production-secret>',
    '<production-2fa-key-min-32-chars>',
    '<development-2fa-key-min-32-chars>',
  );
const traceExporter = Joi.string().trim().valid('otlp', 'zipkin', 'none');
const metricsExporter = Joi.string()
  .trim()
  .valid('otlp', 'prometheus', 'console', 'none');
const providerUrl = Joi.string()
  .trim()
  .empty('')
  .uri({ scheme: ['https'] })
  .max(2048);
const providerToken = Joi.string().trim().empty('').min(1).max(4096);

export const configurationValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  APP_NAME: Joi.string().trim().min(1).max(100).default('estate-pro-api'),
  APP_VERSION: Joi.string().trim().min(1).max(50),
  APP_HOST: Joi.string().trim().min(1).default('0.0.0.0'),
  APP_PORT: Joi.number().integer().min(1).max(65535).default(3000),
  APP_PUBLIC_URL: Joi.alternatives().conditional('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .trim()
      .uri({ scheme: ['http', 'https'] })
      .required(),
    otherwise: Joi.string()
      .trim()
      .uri({ scheme: ['http', 'https'] })
      .default('http://localhost:3000'),
  }),
  API_PREFIX: Joi.string().trim().min(1).default('api'),
  API_VERSION: Joi.string().trim().min(1).default('v1'),
  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false'),
  DATABASE_URL: Joi.string().uri({ scheme: ['mysql'] }).required(),
  DATABASE_POOL_CONNECTION_LIMIT: Joi.number().integer().min(1).max(1000).default(10),
  DATABASE_CONNECT_TIMEOUT_MS: Joi.number().integer().min(1).default(5000),
  DATABASE_ACQUIRE_TIMEOUT_MS: Joi.number().integer().min(1).default(10000),
  DATABASE_POOL_IDLE_TIMEOUT_SEC: Joi.number().integer().min(1).default(300),
  JWT_SECRET: Joi.alternatives().conditional('NODE_ENV', {
    is: Joi.valid('staging', 'production'),
    then: environmentSecret,
    otherwise: Joi.string()
      .trim()
      .min(32)
      .required()
      .invalid(
        'changeme',
        'change-me',
        'your-secret',
        'your-secret-here',
        '<development-jwt-secret-min-32-chars>',
        '<set-in-secret-manager>',
        'replace-with-a-random-32-plus-character-secret',
      ),
  }),
  JWT_EXPIRES_IN: Joi.string().trim().valid('15m').default('15m'),
  AUTH_REFRESH_TOKEN_EXPIRES_IN: Joi.string()
    .trim()
    .pattern(/^(?:[7-9]|1\d|2\d|30)d$/)
    .default('30d'),
  JWT_ISSUER: Joi.string().trim().min(1).max(200).default('estate-pro-api'),
  JWT_AUDIENCE: Joi.string().trim().min(1).max(200).default('estate-pro-client'),
  JWT_ALGORITHM: Joi.string().valid('HS256', 'HS384', 'HS512').default('HS256'),
  AUTH_LOCKOUT_THRESHOLD: Joi.number().integer().min(1).max(100).default(5),
  AUTH_LOCKOUT_WINDOW_MS: Joi.number().integer().min(1000).max(86400000).default(900000),
  AUTH_LOCKOUT_DURATION_MS: Joi.number().integer().min(1000).max(86400000).default(900000),
  AUTH_ARGON2_MEMORY_COST: Joi.number().integer().min(8192).max(262144).default(19456),
  AUTH_ARGON2_TIME_COST: Joi.number().integer().min(1).max(10).default(2),
  AUTH_ARGON2_PARALLELISM: Joi.number().integer().min(1).max(8).default(1),
  AUTH_ARGON2_HASH_LENGTH: Joi.number().integer().min(16).max(128).default(32),
  AUTH_PASSWORD_RESET_TTL_MINUTES: Joi.number().integer().min(5).max(60).default(15),
  AUTH_PASSWORD_RESET_DELIVERY_URL: Joi.string().trim().uri().optional(),
  TWO_FACTOR_ENCRYPTION_KEY: Joi.alternatives().conditional('NODE_ENV', {
    is: Joi.valid('staging', 'production'),
    then: optionalSecret.required(),
    otherwise: Joi.string().min(32).optional(),
  }),
  TWO_FACTOR_CHALLENGE_TTL_MS: Joi.number().integer().min(30000).max(900000).default(300000),
  TWO_FACTOR_CHALLENGE_MAX_ATTEMPTS: Joi.number().integer().min(3).max(10).default(5),
  TWO_FACTOR_OTP_LOCKOUT_THRESHOLD: Joi.number().integer().min(2).max(20).default(5),
  TWO_FACTOR_OTP_LOCKOUT_DURATION_MS: Joi.number().integer().min(60000).max(86400000).default(900000),
  TWO_FACTOR_RECOVERY_CODE_COUNT: Joi.number().integer().min(5).max(20).default(10),
  AUTH_LOGIN_RATE_LIMIT: Joi.number().integer().min(1).max(100).default(5),
  AUTH_LOGIN_RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).max(3600000).default(60000),
  AUTH_REFRESH_RATE_LIMIT: Joi.number().integer().min(1).max(100).default(10),
  AUTH_REFRESH_RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).max(3600000).default(60000),
  AUTOMATION_POLL_INTERVAL_MS: Joi.number().integer().min(100).max(60000).default(1000),
  AUTOMATION_LEASE_MS: Joi.number().integer().min(1000).max(900000).default(30000),
  AUTOMATION_ACTION_TIMEOUT_MS: Joi.number().integer().min(100).max(300000).default(30000),
  AUTOMATION_WORKFLOW_MAX_DURATION_MS: Joi.number().integer().min(1000).max(3600000).default(300000),
  AUTOMATION_WORKFLOW_MAX_DEPTH: Joi.number().integer().min(1).max(100).default(20),
  AUTOMATION_ACTION_MAX_ATTEMPTS: Joi.number().integer().min(1).max(10).default(3),
  AUTOMATION_ACTION_RATE_LIMIT: Joi.number().integer().min(1).max(10000).default(100),
  AUTOMATION_ACTION_RATE_WINDOW_MS: Joi.number().integer().min(1000).max(3600000).default(60000),
  AUTOMATION_SCHEDULER_BATCH_SIZE: Joi.number().integer().min(1).max(1000).default(25),
  SECURITY_CORS_ORIGINS: Joi.string().trim().min(1).required(),
  SECURITY_RATE_LIMIT_TTL: Joi.number().integer().min(1000).default(60000),
  SECURITY_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(100),
  SECURITY_BODY_LIMIT: Joi.string().trim().default('1mb'),
  SECURITY_COMPRESSION_THRESHOLD: Joi.string().trim().default('1kb'),
  SECURITY_GRPC_MAX_MESSAGE_BYTES: Joi.number().integer().min(1024).default(1048576),
  SECURITY_TRUST_PROXY: Joi.string().trim().invalid('true', 'false').optional(),
  SECURITY_CSP_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  SECURITY_HSTS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  SYSTEM_WEBHOOK_ENCRYPTION_KEY: Joi.alternatives().conditional('NODE_ENV', {
    is: Joi.valid('staging', 'production'),
    then: environmentSecret,
    otherwise: Joi.string().trim().min(32).optional(),
  }),
  SYSTEM_WEBHOOK_ALLOW_LOCAL_HTTP: Joi.boolean().truthy('true').falsy('false').default(false),
  SYSTEM_EXPORT_MAX_ROWS: Joi.number().integer().min(1).max(1000000).default(10000),
  SYSTEM_EXPORT_MAX_CONCURRENT: Joi.number().integer().min(1).max(100).default(2),
  SYSTEM_EXPORT_MAX_ARTIFACT_BYTES: Joi.number().integer().min(1024).max(1073741824).default(26214400),
  SYSTEM_EXPORT_RETENTION_HOURS: Joi.number().integer().min(1).max(720).default(24),
  SYSTEM_WEBHOOK_TIMEOUT_MS: Joi.number().integer().min(100).max(60000).default(5000),
  SYSTEM_WEBHOOK_MAX_ATTEMPTS: Joi.number().integer().min(1).max(10).default(5),
  SYSTEM_WEBHOOK_MAX_PAYLOAD_BYTES: Joi.number().integer().min(1024).max(10485760).default(1048576),
  SYSTEM_WEBHOOK_RETENTION_DAYS: Joi.number().integer().min(1).max(3650).default(30),
  EMAIL_PROVIDER_URL: providerUrl.optional(),
  EMAIL_PROVIDER_TOKEN: providerToken.optional(),
  WHATSAPP_PROVIDER_URL: providerUrl.optional(),
  WHATSAPP_PROVIDER_TOKEN: providerToken.optional(),
  SMS_PROVIDER_URL: providerUrl.optional(),
  SMS_PROVIDER_TOKEN: providerToken.optional(),
  CRM_COMMUNICATION_PROVIDER_TIMEOUT_MS: Joi.number().integer().min(250).max(60000).default(10000),
  LOG_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  LOG_LEVEL: Joi.string().trim().valid('trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent').default('info'),
  OTEL_SERVICE_NAME: Joi.string().trim().min(1).max(200).default('estate-pro-api'),
  OTEL_TRACING_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  OTEL_TRACES_EXPORTER: traceExporter.default('none'),
  OTEL_TRACES_SAMPLER: Joi.string().trim().valid('always_on', 'always_off', 'traceidratio', 'parentbased_traceidratio').default('parentbased_traceidratio'),
  OTEL_TRACES_SAMPLER_ARG: Joi.number().min(0).max(1).default(0.1),
  OTEL_METRICS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  OTEL_METRICS_EXPORTER: metricsExporter.default('none'),
  OTEL_METRIC_EXPORT_INTERVAL: Joi.number().integer().min(1000).default(60000),
});
