import type { TwoFactorSnapshot } from '../entities/two-factor.entity.js';

export interface TwoFactorRepository {
  findByUserUuid(userUuid: string): Promise<TwoFactorSnapshot | null>;
  createPending(input: {
    userUuid: string;
    secretEncrypted: string;
    startedAt: Date;
  }): Promise<TwoFactorSnapshot>;
  enable(input: {
    userUuid: string;
    enabledAt: Date;
    lastUsedAt: Date;
    lastUsedTimeStep: bigint;
  }): Promise<boolean>;
  disable(userUuid: string): Promise<void>;
  recordFailedVerification(input: {
    userUuid: string;
    now: Date;
    threshold: number;
    lockDurationMs: number;
  }): Promise<void>;
  recordSuccessfulVerification(input: {
    userUuid: string;
    now: Date;
    timeStep: bigint;
  }): Promise<boolean>;
}

export const TWO_FACTOR_REPOSITORY = Symbol('TWO_FACTOR_REPOSITORY');
