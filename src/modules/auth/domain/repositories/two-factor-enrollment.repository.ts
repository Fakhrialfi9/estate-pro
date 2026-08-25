export interface TwoFactorEnrollmentRepository {
  enableWithRecoveryCodes(input: {
    userUuid: string;
    enabledAt: Date;
    lastUsedAt: Date;
    lastUsedTimeStep: bigint;
    recoveryCodeHashes: readonly string[];
  }): Promise<boolean>;
}

export const TWO_FACTOR_ENROLLMENT_REPOSITORY = Symbol(
  'TWO_FACTOR_ENROLLMENT_REPOSITORY',
);
