export type UserStatus = 'pending' | 'active' | 'inactive' | 'suspended';

export interface UserSnapshot {
  uuid: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface UserUpdate {
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: UserStatus;
  isActive?: boolean;
}

export class UserEntity {
  private constructor(private snapshot: UserSnapshot) {}

  static create(snapshot: UserSnapshot): UserEntity {
    UserEntity.validateSnapshot(snapshot);
    return new UserEntity({ ...snapshot });
  }

  get uuid(): string {
    return this.snapshot.uuid;
  }

  get username(): string | null {
    return this.snapshot.username;
  }

  get email(): string | null {
    return this.snapshot.email;
  }

  get phone(): string | null {
    return this.snapshot.phone;
  }

  get status(): string {
    return this.snapshot.status;
  }

  get isActive(): boolean {
    return this.snapshot.isActive;
  }

  get isVerified(): boolean {
    return this.snapshot.isVerified;
  }

  get createdAt(): Date {
    return this.snapshot.createdAt;
  }

  get updatedAt(): Date {
    return this.snapshot.updatedAt;
  }

  get deletedAt(): Date | null {
    return this.snapshot.deletedAt;
  }

  isAccessible(): boolean {
    return this.snapshot.deletedAt === null && this.snapshot.isActive;
  }

  update(changes: UserUpdate): void {
    if (changes.username !== undefined) this.snapshot.username = changes.username;
    if (changes.email !== undefined) this.snapshot.email = changes.email;
    if (changes.phone !== undefined) this.snapshot.phone = changes.phone;
    if (changes.status !== undefined) this.snapshot.status = changes.status;
    if (changes.isActive !== undefined) this.snapshot.isActive = changes.isActive;

    UserEntity.validateSnapshot(this.snapshot);
  }

  softDelete(at: Date = new Date()): void {
    this.snapshot.deletedAt = at;
    this.snapshot.isActive = false;
    this.snapshot.status = 'inactive';
  }

  toSnapshot(): UserSnapshot {
    return { ...this.snapshot };
  }

  private static validateSnapshot(snapshot: UserSnapshot): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(snapshot.uuid)) {
      throw new Error('Invalid user UUID');
    }
    if (snapshot.username === null && snapshot.email === null && snapshot.phone === null) {
      throw new Error('User requires at least one identity');
    }
    if (!snapshot.status.trim() || snapshot.status.length > 30) {
      throw new Error('Invalid user status');
    }
  }
}
