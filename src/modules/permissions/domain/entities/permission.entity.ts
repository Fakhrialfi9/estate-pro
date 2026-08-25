export interface PermissionSnapshot {
  uuid: string;
  name: string;
  code: string;
  module: string;
  domain: string;
  action: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionUpdate {
  name?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEGMENT_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const CODE_PATTERN =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?::[a-z][a-z0-9]*(?:-[a-z0-9]+)*){2}$/;
const MAX_NAME_LENGTH = 150;
const MAX_SEGMENT_LENGTH = 100;
const MAX_ACTION_LENGTH = 50;

/**
 * Permission protection is derived from the stable permission identifier, not
 * from a mutable display label. These codes are intentionally explicit so a
 * future policy cannot accidentally treat a similarly named permission as
 * protected.
 */
export const PROTECTED_PERMISSION_CODES = [
  'roles:manage:protected',
  'permissions:manage:protected',
] as const;

export const normalizePermissionSegment = (value: string): string =>
  value.normalize('NFKC').trim().toLowerCase();

export const normalizePermissionName = (value: string): string =>
  value.normalize('NFKC').trim().replace(/\s+/gu, ' ');

export const buildPermissionCode = (
  module: string,
  domain: string,
  action: string,
): string => [module, domain, action].map(normalizePermissionSegment).join(':');

export const isProtectedPermissionCode = (code: string): boolean =>
  PROTECTED_PERMISSION_CODES.includes(
    code as (typeof PROTECTED_PERMISSION_CODES)[number],
  );

export class PermissionEntity {
  private constructor(private snapshot: PermissionSnapshot) {}

  static create(snapshot: PermissionSnapshot): PermissionEntity {
    const normalized = {
      ...snapshot,
      name: normalizePermissionName(snapshot.name),
      module: normalizePermissionSegment(snapshot.module),
      domain: normalizePermissionSegment(snapshot.domain),
      action: normalizePermissionSegment(snapshot.action),
      code: normalizePermissionSegment(snapshot.code).replace(/\s+/gu, ''),
    };

    PermissionEntity.validateSnapshot(normalized);
    if (
      normalized.code !==
      buildPermissionCode(
        normalized.module,
        normalized.domain,
        normalized.action,
      )
    ) {
      throw new Error('Invalid permission identifier');
    }
    return new PermissionEntity(normalized);
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

  get module(): string {
    return this.snapshot.module;
  }

  get domain(): string {
    return this.snapshot.domain;
  }

  get action(): string {
    return this.snapshot.action;
  }

  get createdAt(): Date {
    return this.snapshot.createdAt;
  }

  get updatedAt(): Date {
    return this.snapshot.updatedAt;
  }

  get isSystem(): boolean {
    return isProtectedPermissionCode(this.snapshot.code);
  }

  get resource(): string {
    return `${this.snapshot.module}:${this.snapshot.domain}`;
  }

  update(changes: PermissionUpdate): void {
    if (changes.name !== undefined) {
      this.snapshot.name = normalizePermissionName(changes.name);
    }
    PermissionEntity.validateSnapshot(this.snapshot);
  }

  toSnapshot(): PermissionSnapshot {
    return { ...this.snapshot };
  }

  private static validateSnapshot(snapshot: PermissionSnapshot): void {
    if (!UUID_PATTERN.test(snapshot.uuid))
      throw new Error('Invalid permission UUID');
    if (!snapshot.name || snapshot.name.length > MAX_NAME_LENGTH)
      throw new Error('Invalid permission name');
    if (
      !snapshot.module ||
      snapshot.module.length > MAX_SEGMENT_LENGTH ||
      !SEGMENT_PATTERN.test(snapshot.module)
    ) {
      throw new Error('Invalid permission module');
    }
    if (
      !snapshot.domain ||
      snapshot.domain.length > MAX_SEGMENT_LENGTH ||
      !SEGMENT_PATTERN.test(snapshot.domain)
    ) {
      throw new Error('Invalid permission domain');
    }
    if (
      !snapshot.action ||
      snapshot.action.length > MAX_ACTION_LENGTH ||
      !SEGMENT_PATTERN.test(snapshot.action)
    ) {
      throw new Error('Invalid permission action');
    }
    if (!CODE_PATTERN.test(snapshot.code))
      throw new Error('Invalid permission identifier');
  }
}
