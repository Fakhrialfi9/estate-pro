import { registerAs } from '@nestjs/config';

import { SENSITIVE_LOG_PATHS } from '../common/constants/security.constants.js';

export default registerAs('logging', () => ({
  enabled: process.env.LOG_ENABLED !== 'false',
  level: process.env.LOG_LEVEL ?? 'info',
  pretty: process.env.NODE_ENV !== 'production',
  redact: [...SENSITIVE_LOG_PATHS],
}));
