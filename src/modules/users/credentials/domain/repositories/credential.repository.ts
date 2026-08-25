import type { CredentialEntity } from '../entities/credential.entity.js';

export interface CredentialRepository {
  create(userUuid: string, passwordHash: string): Promise<CredentialEntity>;
  findByUserUuid(userUuid: string): Promise<CredentialEntity | null>;
  updatePassword(userUuid: string, passwordHash: string, changedAt: Date): Promise<CredentialEntity>;
  createResetToken(userUuid: string, tokenDigest: string, expiresAt: Date): Promise<void>;
  resetPasswordAtomically(tokenDigest: string, passwordHash: string, now: Date): Promise<string | null>;
}

export const CREDENTIAL_REPOSITORY = Symbol('CREDENTIAL_REPOSITORY');
