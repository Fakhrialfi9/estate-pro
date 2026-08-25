export type SessionStatus = 'active' | 'expired' | 'revoked';

export interface SessionSnapshot {
  id: string;
  userUuid: string;
  sessionIdHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastActivityAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}

export class SessionEntity {
  private constructor(private readonly snapshot: SessionSnapshot) {}

  static create(snapshot: SessionSnapshot): SessionEntity {
    if (!/^\d+$/.test(snapshot.id)) throw new Error('Invalid session id');
    if (!snapshot.userUuid.trim()) throw new Error('Invalid session owner');
    if (!/^[a-f0-9]{64}$/.test(snapshot.sessionIdHash)) {
      throw new Error('Invalid session digest');
    }
    if (snapshot.expiresAt.getTime() <= snapshot.createdAt.getTime()) {
      throw new Error('Session expiry must be after creation');
    }
    return new SessionEntity({ ...snapshot });
  }

  get id(): string {
    return this.snapshot.id;
  }

  get userUuid(): string {
    return this.snapshot.userUuid;
  }

  get ipAddress(): string | null {
    return this.snapshot.ipAddress;
  }

  get userAgent(): string | null {
    return this.snapshot.userAgent;
  }

  get createdAt(): Date {
    return this.snapshot.createdAt;
  }

  get lastActivityAt(): Date | null {
    return this.snapshot.lastActivityAt;
  }

  get revokedAt(): Date | null {
    return this.snapshot.revokedAt;
  }

  get expiresAt(): Date {
    return this.snapshot.expiresAt;
  }

  statusAt(now: Date): SessionStatus {
    if (this.snapshot.revokedAt !== null) return 'revoked';
    if (this.snapshot.expiresAt.getTime() <= now.getTime()) return 'expired';
    return 'active';
  }

  isActiveAt(now: Date): boolean {
    return this.statusAt(now) === 'active';
  }

  toSnapshot(): SessionSnapshot {
    return { ...this.snapshot };
  }

  toSafeView(now: Date): {
    id: string;
    status: SessionStatus;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    lastActivityAt: Date | null;
    expiresAt: Date;
    revokedAt: Date | null;
  } {
    return {
      id: this.id,
      status: this.statusAt(now),
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
      expiresAt: this.expiresAt,
      revokedAt: this.revokedAt,
    };
  }
}
