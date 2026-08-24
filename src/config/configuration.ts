import Joi from 'joi';

import apiConfig from './api.config.js';
import appConfig from './app.config.js';
import databaseConfig from './database.config.js';

export const configuration = [appConfig, apiConfig, databaseConfig];

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
  DATABASE_URL: Joi.string().uri({ scheme: ['mysql', 'mariadb'] }),
  DATABASE_HOST: Joi.string().trim().min(1).default('localhost'),
  DATABASE_PORT: Joi.number().integer().min(1).max(65535).default(3306),
  DATABASE_NAME: Joi.string().trim().min(1).default('estate_pro'),
  DATABASE_USER: Joi.string().allow('').default(''),
  DATABASE_PASSWORD: Joi.string().allow('').default(''),
  DATABASE_POOL_CONNECTION_LIMIT: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(10),
  DATABASE_CONNECT_TIMEOUT_MS: Joi.number().integer().min(1).default(5000),
  DATABASE_ACQUIRE_TIMEOUT_MS: Joi.number().integer().min(1).default(10000),
  DATABASE_POOL_IDLE_TIMEOUT_SEC: Joi.number().integer().min(1).default(300),
});
