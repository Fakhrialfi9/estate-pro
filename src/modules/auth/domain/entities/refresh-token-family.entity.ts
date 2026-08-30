export type RefreshTokenFamilyStatus = 'active' | 'revoked';

export interface RefreshTokenFamilySnapshot {
  id: string;
  userUuid: string;
  sessionId: string;
  revokedAt: Date | null;
  revokeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class RefreshTokenFamilyEntity {
  private constructor(private readonly snapshot: RefreshTokenFamilySnapshot) {}

  static create(
    snapshot: RefreshTokenFamilySnapshot,
  ): RefreshTokenFamilyEntity {
    if (!/^[0-9a-f-]{36}$/i.test(snapshot.id))
      throw new Error('Invalid refresh token family id');
    if (!snapshot.userUuid.trim() || !/^\d+$/.test(snapshot.sessionId))
      throw new Error('Invalid refresh token family owner');
    return new RefreshTokenFamilyEntity({ ...snapshot });
  }

  get id(): string {
    return this.snapshot.id;
  }
  get userUuid(): string {
    return this.snapshot.userUuid;
  }
  get sessionId(): string {
    return this.snapshot.sessionId;
  }
  get revokedAt(): Date | null {
    return this.snapshot.revokedAt;
  }
  get revokeReason(): string | null {
    return this.snapshot.revokeReason;
  }

  status(): RefreshTokenFamilyStatus {
    return this.snapshot.revokedAt === null ? 'active' : 'revoked';
  }
  isActive(): boolean {
    return this.snapshot.revokedAt === null;
  }
}
