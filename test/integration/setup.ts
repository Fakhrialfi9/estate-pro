import { prepareTestDatabase } from '../database/setup.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'estate-pro-integration-test-secret-32-chars-minimum';
process.env.JWT_EXPIRES_IN ??= '15m';
process.env.JWT_ISSUER ??= 'estate-pro-api-test';
process.env.JWT_AUDIENCE ??= 'estate-pro-client';
process.env.JWT_ALGORITHM ??= 'HS256';
process.env.AUTH_ARGON2_MEMORY_COST ??= '19456';
process.env.AUTH_ARGON2_TIME_COST ??= '2';
process.env.AUTH_ARGON2_PARALLELISM ??= '1';
process.env.TWO_FACTOR_ENCRYPTION_KEY ??=
  'estate-pro-two-factor-integration-key-32-chars-minimum';

prepareTestDatabase();
