const requireSeedSecret = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be provided for database seeding`);
  }
  return value;
};

export const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'fakhrialfi9@example.test';
export const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME ?? 'fakhrialfi9';
export const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE ?? '+6289644922233';
export const ADMIN_PASSWORD = requireSeedSecret('SEED_ADMIN_PASSWORD');
export const DEVELOPMENT_USER_PASSWORD = requireSeedSecret('SEED_DEVELOPMENT_USER_PASSWORD');

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
