import { registerAs } from '@nestjs/config';

export const LOGIN_RATE_LIMIT = {
  ttl: Number(process.env.AUTH_LOGIN_RATE_LIMIT_TTL_MS ?? 60000),
  limit: Number(process.env.AUTH_LOGIN_RATE_LIMIT ?? 5),
} as const;

export default registerAs('rateLimit', () => ({
  ttl: Number(process.env.SECURITY_RATE_LIMIT_TTL ?? 60000),
  limit: Number(process.env.SECURITY_RATE_LIMIT_MAX ?? 100),
  login: LOGIN_RATE_LIMIT,
}));
