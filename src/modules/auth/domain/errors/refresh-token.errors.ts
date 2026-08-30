import type { RefreshTokenRevokeReason } from '../entities/refresh-token.entity.js';

export class RefreshTokenInvalidError extends Error {
  readonly code = 'REFRESH_TOKEN_INVALID';
  constructor() {
    super('Refresh token is invalid');
    this.name = 'RefreshTokenInvalidError';
  }
}

export class RefreshTokenExpiredError extends Error {
  readonly code = 'REFRESH_TOKEN_EXPIRED';
  constructor() {
    super('Refresh token is expired');
    this.name = 'RefreshTokenExpiredError';
  }
}

export class RefreshTokenRevokedError extends Error {
  readonly code = 'REFRESH_TOKEN_REVOKED';
  constructor() {
    super('Refresh token is revoked');
    this.name = 'RefreshTokenRevokedError';
  }
}

export class RefreshTokenReuseDetectedError extends Error {
  readonly code = 'REFRESH_TOKEN_REUSE_DETECTED';
  constructor() {
    super('Refresh token reuse detected');
    this.name = 'RefreshTokenReuseDetectedError';
  }
}

export class RefreshTokenSessionInvalidError extends Error {
  readonly code = 'REFRESH_TOKEN_SESSION_INVALID';
  constructor() {
    super('Refresh token session is invalid');
    this.name = 'RefreshTokenSessionInvalidError';
  }
}

export const isRefreshTokenRevokeReason = (
  value: unknown,
): value is RefreshTokenRevokeReason =>
  typeof value === 'string' &&
  [
    'LOGOUT',
    'ROTATED',
    'REUSE_DETECTED',
    'PASSWORD_CHANGED',
    'PASSWORD_RESET',
    'SECURITY_EVENT',
    'ADMIN_REVOKED',
    'SESSION_REVOKED',
    'ACCOUNT_DISABLED',
    'ACCOUNT_SUSPENDED',
    'ACCOUNT_DELETED',
    'ACCOUNT_LOCKED',
  ].includes(value);
