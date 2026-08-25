export interface TwoFactorChallengeSnapshot {
  id: bigint;
  userUuid: string;
  challengeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  failedAttempts: number;
  createdAt: Date;
}

export interface TwoFactorChallengeRepository {
  create(input: { userUuid: string; challengeHash: string; expiresAt: Date }): Promise<void>;
  findByHash(challengeHash: string): Promise<TwoFactorChallengeSnapshot | null>;
  recordFailure(id: bigint): Promise<void>;
  consume(id: bigint, now: Date): Promise<boolean>;
}

export const TWO_FACTOR_CHALLENGE_REPOSITORY = Symbol('TWO_FACTOR_CHALLENGE_REPOSITORY');
