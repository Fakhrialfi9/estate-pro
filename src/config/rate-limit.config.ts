import { registerAs } from '@nestjs/config';

type RateLimitPolicy = Readonly<{
  ttl: number;
  limit: number;
}>;

const fromEnv = (
  ttlKey: string,
  limitKey: string,
  defaultTtl: number,
  defaultLimit: number,
): RateLimitPolicy => ({
  ttl: Number(process.env[ttlKey] ?? defaultTtl),
  limit: Number(process.env[limitKey] ?? defaultLimit),
});

export const LOGIN_RATE_LIMIT = fromEnv(
  'AUTH_LOGIN_RATE_LIMIT_TTL_MS',
  'AUTH_LOGIN_RATE_LIMIT',
  60000,
  5,
);
export const REFRESH_RATE_LIMIT = fromEnv(
  'AUTH_REFRESH_RATE_LIMIT_TTL_MS',
  'AUTH_REFRESH_RATE_LIMIT',
  60000,
  10,
);
export const SECURITY_SESSION_RATE_LIMIT = fromEnv(
  'SECURITY_SESSION_RATE_LIMIT_TTL_MS',
  'SECURITY_SESSION_RATE_LIMIT_MAX',
  60000,
  30,
);
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
export const PROPERTY_MATCHING_RATE_LIMIT = {
  ttl: 60000,
  limit: 20,
} as const;
export const PROPERTY_RECOMMENDATION_GENERATE_RATE_LIMIT = {
  ttl: 60000,
  limit: 10,
} as const;
export const PROPERTY_RECOMMENDATION_REFRESH_RATE_LIMIT = {
  ttl: 60000,
  limit: 5,
} as const;
export const PROPERTY_MATCHING_FEEDBACK_RATE_LIMIT = {
  ttl: 60000,
  limit: 30,
} as const;

export default registerAs('rateLimit', () => ({
  ttl: Number(process.env.SECURITY_RATE_LIMIT_TTL ?? 60000),
  limit: Number(process.env.SECURITY_RATE_LIMIT_MAX ?? 100),
  login: fromEnv(
    'AUTH_LOGIN_RATE_LIMIT_TTL_MS',
    'AUTH_LOGIN_RATE_LIMIT',
    60000,
    5,
  ),
  refresh: fromEnv(
    'AUTH_REFRESH_RATE_LIMIT_TTL_MS',
    'AUTH_REFRESH_RATE_LIMIT',
    60000,
    10,
  ),
  session: fromEnv(
    'SECURITY_SESSION_RATE_LIMIT_TTL_MS',
    'SECURITY_SESSION_RATE_LIMIT_MAX',
    60000,
    30,
  ),
  propertyMatching: PROPERTY_MATCHING_RATE_LIMIT,
  propertyRecommendationGenerate: PROPERTY_RECOMMENDATION_GENERATE_RATE_LIMIT,
  propertyRecommendationRefresh: PROPERTY_RECOMMENDATION_REFRESH_RATE_LIMIT,
  propertyMatchingFeedback: PROPERTY_MATCHING_FEEDBACK_RATE_LIMIT,
}));
