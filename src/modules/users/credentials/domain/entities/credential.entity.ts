export interface CredentialSnapshot {
  userUuid: string;
  passwordHash: string;
  passwordChangedAt: Date | null;
  passwordExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CredentialEntity {
  private constructor(private readonly snapshot: CredentialSnapshot) {}

  static create(snapshot: CredentialSnapshot): CredentialEntity {
    if (!snapshot.userUuid || !snapshot.passwordHash) {
      throw new Error('Credential requires a user identity and password hash');
    }
    return new CredentialEntity({ ...snapshot });
  }

  get userUuid(): string {
    return this.snapshot.userUuid;
  }

  get passwordHash(): string {
    return this.snapshot.passwordHash;
  }

  get passwordChangedAt(): Date | null {
    return this.snapshot.passwordChangedAt;
  }

  get passwordExpiresAt(): Date | null {
    return this.snapshot.passwordExpiresAt;
  }

  get createdAt(): Date {
    return this.snapshot.createdAt;
  }

  get updatedAt(): Date {
    return this.snapshot.updatedAt;
  }

  toSnapshot(): CredentialSnapshot {
    return { ...this.snapshot };
  }
}
