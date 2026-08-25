export interface RoleSnapshot {
  uuid: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  isSystem: boolean;
}

export interface RoleUpdate {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 100;
const MAX_CODE_LENGTH = 100;
const PROTECTED_CODES = new Set(['admin', 'owner', 'super-admin', 'system']);

export const normalizeRoleName = (value: string): string =>
  value.normalize('NFKC').trim().replace(/\s+/gu, ' ');

export const normalizeRoleCode = (value: string): string =>
  value.normalize('NFKC').trim().toLowerCase();

export class RoleEntity {
  private constructor(private snapshot: RoleSnapshot) {}

  static create(snapshot: RoleSnapshot): RoleEntity {
    const normalized = {
      ...snapshot,
      name: normalizeRoleName(snapshot.name),
      code: normalizeRoleCode(snapshot.code),
    };

    RoleEntity.validateSnapshot(normalized);
    return new RoleEntity(normalized);
  }

  get uuid(): string {
    return this.snapshot.uuid;
  }
  get name(): string {
    return this.snapshot.name;
  }
  get code(): string {
    return this.snapshot.code;
  }
  get description(): string | null {
    return this.snapshot.description;
  }
  get isActive(): boolean {
    return this.snapshot.isActive;
  }
  get createdAt(): Date {
    return this.snapshot.createdAt;
  }
  get updatedAt(): Date {
    return this.snapshot.updatedAt;
  }
  get isSystem(): boolean {
    return this.snapshot.isSystem;
  }

  update(changes: RoleUpdate): void {
    if (changes.name !== undefined)
      this.snapshot.name = normalizeRoleName(changes.name);
    if (changes.description !== undefined) {
      this.snapshot.description =
        changes.description === null
          ? null
          : changes.description.normalize('NFKC').trim();
    }
    if (changes.isActive !== undefined)
      this.snapshot.isActive = changes.isActive;
    RoleEntity.validateSnapshot(this.snapshot);
  }

  toSnapshot(): RoleSnapshot {
    return { ...this.snapshot };
  }

  private static validateSnapshot(snapshot: RoleSnapshot): void {
    if (!UUID_PATTERN.test(snapshot.uuid)) throw new Error('Invalid role UUID');
    if (!snapshot.name || snapshot.name.length > MAX_NAME_LENGTH)
      throw new Error('Invalid role name');
    if (
      !snapshot.code ||
      snapshot.code.length > MAX_CODE_LENGTH ||
      !CODE_PATTERN.test(snapshot.code)
    ) {
      throw new Error('Invalid role code');
    }
    if (snapshot.isSystem !== PROTECTED_CODES.has(snapshot.code)) {
      throw new Error('Invalid role protection state');
    }
    if (snapshot.description !== null && snapshot.description.length > 5000) {
      throw new Error('Invalid role description');
    }
    if (snapshot.isSystem && !snapshot.isActive) {
      throw new Error('System role must remain active');
    }
  }
}

export const isProtectedRoleCode = (code: string): boolean =>
  PROTECTED_CODES.has(normalizeRoleCode(code));
