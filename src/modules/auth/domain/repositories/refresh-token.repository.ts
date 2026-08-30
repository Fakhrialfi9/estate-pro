import type { RefreshTokenSnapshot, RefreshTokenRevokeReason } from '../entities/refresh-token.entity.js';

export interface RefreshRotationSuccess {
  oldTokenId: string;
  familyId: string;
  userUuid: string;
  sessionId: string;
  newToken: string;
  newTokenExpiresAt: Date;
}

export type RefreshRotationResult =
  | { kind: 'ROTATED'; value: RefreshRotationSuccess }
  | { kind: 'REUSE_DETECTED'; familyId: string; userUuid: string; sessionId: string }
  | { kind: 'INVALID' }
  | { kind: 'EXPIRED'; snapshot: RefreshTokenSnapshot }
  | { kind: 'REVOKED'; snapshot: RefreshTokenSnapshot };

export interface RefreshTokenRepository {
  rotate(
    tokenHash: string,
    createReplacement: (input: { familyId: string; sessionId: string }) => {
      token: string;
      tokenHash: string;
      expiresAt: Date;
    },
    now: Date,
  ): Promise<RefreshRotationResult>;
  revokeForFamily(familyId: string, reason: RefreshTokenRevokeReason, now: Date): Promise<number>;
  revokeAllForUser(userUuid: string, reason: RefreshTokenRevokeReason, now: Date): Promise<number>;
  revokeForSession(userUuid: string, sessionId: string, reason: RefreshTokenRevokeReason, now: Date): Promise<number>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');
