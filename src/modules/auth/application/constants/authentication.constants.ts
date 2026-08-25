export const AUTHENTICATION_POLICY = {
  lockout: {
    threshold: 5,
    windowMs: 15 * 60 * 1000,
    durationMs: 15 * 60 * 1000,
  },
} as const;

export const AUTH_ACTIONS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
} as const;

export const AUTH_FAILURE_REASONS = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
} as const;
