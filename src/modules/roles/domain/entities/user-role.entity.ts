export interface UserRoleSnapshot {
  userUuid: string;
  roleUuid: string;
  roleName: string;
  roleCode: string;
  roleIsSystem: boolean;
  isActive: boolean;
  assignedByUuid: string | null;
  assignedAt: Date;
  revokedAt: Date | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class UserRoleEntity {
  private constructor(private readonly snapshot: UserRoleSnapshot) {}

  static create(snapshot: UserRoleSnapshot): UserRoleEntity {
    if (!UUID_PATTERN.test(snapshot.userUuid)) throw new Error('Invalid user UUID');
    if (!UUID_PATTERN.test(snapshot.roleUuid)) throw new Error('Invalid role UUID');
    if (!snapshot.roleName.trim() || !snapshot.roleCode.trim()) {
      throw new Error('Invalid role identity');
    }
    if (!snapshot.isActive && snapshot.revokedAt === null) {
      throw new Error('Inactive user role must have a revoked timestamp');
    }
    if (snapshot.isActive && snapshot.revokedAt !== null) {
      throw new Error('Active user role cannot have a revoked timestamp');
    }
    return new UserRoleEntity({ ...snapshot });
  }

  get userUuid(): string { return this.snapshot.userUuid; }
  get roleUuid(): string { return this.snapshot.roleUuid; }
  get roleName(): string { return this.snapshot.roleName; }
  get roleCode(): string { return this.snapshot.roleCode; }
  get roleIsSystem(): boolean { return this.snapshot.roleIsSystem; }
  get isActive(): boolean { return this.snapshot.isActive; }
  get assignedByUuid(): string | null { return this.snapshot.assignedByUuid; }
  get assignedAt(): Date { return this.snapshot.assignedAt; }
  get revokedAt(): Date | null { return this.snapshot.revokedAt; }

  toSnapshot(): UserRoleSnapshot { return { ...this.snapshot }; }
}
