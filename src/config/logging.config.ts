import { registerAs } from '@nestjs/config';

export default registerAs('logging', () => ({
  enabled: process.env.LOG_ENABLED !== 'false',
  level: process.env.LOG_LEVEL ?? 'info',
  pretty: process.env.NODE_ENV !== 'production',
  redact: [
    'req.headers.authorization',
    'req.headers.cookie',
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'privateKey',
  ],
}));
