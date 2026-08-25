import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    issuer: process.env.JWT_ISSUER ?? 'estate-pro-api',
    audience: process.env.JWT_AUDIENCE ?? 'estate-pro-client',
    algorithm: process.env.JWT_ALGORITHM ?? 'HS256',
  },
  login: {
    lockoutThreshold: Number(process.env.AUTH_LOCKOUT_THRESHOLD ?? 5),
    lockoutWindowMs: Number(process.env.AUTH_LOCKOUT_WINDOW_MS ?? 900000),
    lockoutDurationMs: Number(process.env.AUTH_LOCKOUT_DURATION_MS ?? 900000),
  },
  passwordHashing: {
    memoryCost: Number(process.env.AUTH_ARGON2_MEMORY_COST ?? 19456),
    timeCost: Number(process.env.AUTH_ARGON2_TIME_COST ?? 2),
    parallelism: Number(process.env.AUTH_ARGON2_PARALLELISM ?? 1),
    hashLength: Number(process.env.AUTH_ARGON2_HASH_LENGTH ?? 32),
  },
  passwordReset: {
    tokenTtlMinutes: Number(process.env.AUTH_PASSWORD_RESET_TTL_MINUTES ?? 15),
    deliveryUrl: process.env.AUTH_PASSWORD_RESET_DELIVERY_URL,
  },
  twoFactor: {
    encryptionKey: process.env.TWO_FACTOR_ENCRYPTION_KEY,
    challengeTtlMs: Number(process.env.TWO_FACTOR_CHALLENGE_TTL_MS ?? 300000),
    challengeMaxAttempts: Number(process.env.TWO_FACTOR_CHALLENGE_MAX_ATTEMPTS ?? 5),
    otpLockoutThreshold: Number(process.env.TWO_FACTOR_OTP_LOCKOUT_THRESHOLD ?? 5),
    otpLockoutDurationMs: Number(process.env.TWO_FACTOR_OTP_LOCKOUT_DURATION_MS ?? 900000),
    recoveryCodeCount: Number(process.env.TWO_FACTOR_RECOVERY_CODE_COUNT ?? 10),
  },
}));
