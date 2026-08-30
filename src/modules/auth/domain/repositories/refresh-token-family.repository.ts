import type { RefreshTokenRevokeReason } from '../entities/refresh-token.entity.js';

export interface CreateRefreshFamilyInput {
  userUuid: string;
  sessionId: string;
  tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
}

export interface RefreshTokenFamilyRepository {
  createWithInitialToken(input: CreateRefreshFamilyInput): Promise<{ familyId: string; tokenId: string }>;
  revokeFamily(familyId: string, reason: RefreshTokenRevokeReason, now: Date): Promise<number>;
}

export const REFRESH_TOKEN_FAMILY_REPOSITORY = Symbol('REFRESH_TOKEN_FAMILY_REPOSITORY');
