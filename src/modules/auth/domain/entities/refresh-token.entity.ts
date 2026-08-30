export type RefreshTokenState = 'ACTIVE' | 'CONSUMED' | 'REVOKED' | 'EXPIRED';

export interface RefreshTokenSnapshot {
  id: string;
  familyId: string;
  userUuid: string;
  sessionId: string;
  tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  revokeReason: RefreshTokenRevokeReason | null;
}

export type RefreshTokenRevokeReason =
  | 'LOGOUT'
  | 'ROTATED'
  | 'REUSE_DETECTED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET'
  | 'SECURITY_EVENT'
  | 'ADMIN_REVOKED'
  | 'SESSION_REVOKED'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_DELETED'
  | 'ACCOUNT_LOCKED';

export interface RefreshTokenEntityProps extends RefreshTokenSnapshot {}

export class RefreshTokenEntity {
  private constructor(private readonly props: RefreshTokenEntityProps) {}

  static create(snapshot: RefreshTokenSnapshot): RefreshTokenEntity {
    if (!/^[0-9a-f]{64}$/i.test(snapshot.tokenHash)) {
      throw new Error('Invalid refresh token digest');
    }
    if (snapshot.expiresAt.getTime() <= snapshot.issuedAt.getTime()) {
      throw new Error('Refresh token expiry must be after issuance');
    }
    return new RefreshTokenEntity(snapshot);
  }

  get id(): string { return this.props.id; }
  get familyId(): string { return this.props.familyId; }
  get userUuid(): string { return this.props.userUuid; }
  get sessionId(): string { return this.props.sessionId; }
  get expiresAt(): Date { return this.props.expiresAt; }
  get consumedAt(): Date | null { return this.props.consumedAt; }
  get revokedAt(): Date | null { return this.props.revokedAt; }
  get revokeReason(): RefreshTokenRevokeReason | null { return this.props.revokeReason; }

  state(now = new Date()): RefreshTokenState {
    if (this.props.revokedAt !== null || this.props.consumedAt !== null) return this.props.consumedAt !== null ? 'CONSUMED' : 'REVOKED';
    if (this.props.expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
    return 'ACTIVE';
  }

  assertRefreshable(now = new Date()): void {
    const state = this.state(now);
    if (state !== 'ACTIVE') throw new Error(`Refresh token is ${state.toLowerCase()}`);
  }
}
