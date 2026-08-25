export interface RolePermissionSnapshot {
  roleUuid: string;
  permissionUuid: string;
  createdAt: Date;
  updatedAt: Date;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class RolePermissionEntity {
  private constructor(private readonly snapshot: RolePermissionSnapshot) {}

  static create(snapshot: RolePermissionSnapshot): RolePermissionEntity {
    if (!UUID_PATTERN.test(snapshot.roleUuid)) {
      throw new Error('Invalid role UUID');
    }
    if (!UUID_PATTERN.test(snapshot.permissionUuid)) {
      throw new Error('Invalid permission UUID');
    }
    return new RolePermissionEntity({ ...snapshot });
  }

  get roleUuid(): string {
    return this.snapshot.roleUuid;
  }

  get permissionUuid(): string {
    return this.snapshot.permissionUuid;
  }

  get createdAt(): Date {
    return this.snapshot.createdAt;
  }

  get updatedAt(): Date {
    return this.snapshot.updatedAt;
  }

  toSnapshot(): RolePermissionSnapshot {
    return { ...this.snapshot };
  }
}
