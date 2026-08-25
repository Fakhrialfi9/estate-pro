export type TwoFactorStatus = 'PENDING' | 'ENABLED';

export interface TwoFactorSnapshot {
  id: bigint;
  userUuid: string;
  method: string;
  secretEncrypted: string;
  enabledAt: Date | null;
  lastUsedAt: Date | null;
  lastUsedTimeStep: bigint | null;
  enrollmentStartedAt: Date | null;
  failedVerificationAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class TwoFactorEntity {
  private constructor(private readonly snapshot: TwoFactorSnapshot) {}

  static create(snapshot: TwoFactorSnapshot): TwoFactorEntity {
    return new TwoFactorEntity(snapshot);
  }

  get id(): bigint {
    return this.snapshot.id;
  }

  get userUuid(): string {
    return this.snapshot.userUuid;
  }

  get encryptedSecret(): string {
    return this.snapshot.secretEncrypted;
  }

  get status(): TwoFactorStatus {
    return this.snapshot.enabledAt ? 'ENABLED' : 'PENDING';
  }

  get failedVerificationAttempts(): number {
    return this.snapshot.failedVerificationAttempts;
  }

  isEnabled(): boolean {
    return this.snapshot.enabledAt !== null;
  }

  isPending(): boolean {
    return this.snapshot.enabledAt === null;
  }

  isLocked(now = new Date()): boolean {
    return this.snapshot.lockedUntil !== null && this.snapshot.lockedUntil > now;
  }

  lastUsedTimeStep(): bigint | null {
    return this.snapshot.lastUsedTimeStep;
  }

  toPersistence(): TwoFactorSnapshot {
    return { ...this.snapshot };
  }
}
