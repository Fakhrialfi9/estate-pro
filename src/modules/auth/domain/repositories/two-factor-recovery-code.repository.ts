export interface TwoFactorRecoveryCodeRepository {
  replaceAll(userUuid: string, hashes: readonly string[]): Promise<void>;
  findUnused(userUuid: string): Promise<readonly { id: bigint; codeHash: string }[]>;
  markUsed(id: bigint, usedAt: Date): Promise<boolean>;
}

export const TWO_FACTOR_RECOVERY_CODE_REPOSITORY = Symbol('TWO_FACTOR_RECOVERY_CODE_REPOSITORY');
