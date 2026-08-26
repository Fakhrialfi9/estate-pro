export const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'fakhrialfi9@example.com';
export const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME ?? 'fakhrialfi9';
export const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE ?? '+6289644922233';
export const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Q2@mK7xZa9Lp';

export const ADMIN_ROLE = {
  name: 'Administrator',
  code: 'ADMIN',
  description: 'Full administrative access for development and testing.',
} as const;

export const ARGON2_CONFIG = {
  memoryCost: Number(process.env.AUTH_ARGON2_MEMORY_COST ?? 19456),
  timeCost: Number(process.env.AUTH_ARGON2_TIME_COST ?? 2),
  parallelism: Number(process.env.AUTH_ARGON2_PARALLELISM ?? 1),
} as const;
