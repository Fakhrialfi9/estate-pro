import { registerAs } from '@nestjs/config';

export const LOGIN_RATE_LIMIT = {
  ttl: Number(process.env.AUTH_LOGIN_RATE_LIMIT_TTL_MS ?? 60000),
  limit: Number(process.env.AUTH_LOGIN_RATE_LIMIT ?? 5),
} as const;
export const REFRESH_RATE_LIMIT = {
  ttl: Number(process.env.AUTH_REFRESH_RATE_LIMIT_TTL_MS ?? 60000),
  limit: Number(process.env.AUTH_REFRESH_RATE_LIMIT ?? 10),
} as const;
export const SECURITY_SESSION_RATE_LIMIT = {
  ttl: Number(process.env.SECURITY_SESSION_RATE_LIMIT_TTL_MS ?? 60000),
  limit: Number(process.env.SECURITY_SESSION_RATE_LIMIT_MAX ?? 30),
} as const;
export const TWO_FACTOR_ENROLLMENT_RATE_LIMIT = {
  ttl: 60000,
  limit: 5,
} as const;
export const TWO_FACTOR_VERIFICATION_RATE_LIMIT = {
  ttl: 60000,
  limit: 10,
} as const;
export const TWO_FACTOR_REAUTH_RATE_LIMIT = { ttl: 60000, limit: 5 } as const;
export const TWO_FACTOR_RECOVERY_REGENERATION_RATE_LIMIT = {
  ttl: 60000,
  limit: 3,
} as const;

export default registerAs('rateLimit', () => ({
  ttl: Number(process.env.SECURITY_RATE_LIMIT_TTL ?? 60000),
  limit: Number(process.env.SECURITY_RATE_LIMIT_MAX ?? 100),
  login: LOGIN_RATE_LIMIT,
  refresh: REFRESH_RATE_LIMIT,
  session: SECURITY_SESSION_RATE_LIMIT,
}));
