import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  USER_AUTHORIZATION_REPOSITORY,
  type AuthorizationSnapshot,
  type UserAuthorizationRepository,
} from './authorization.repository.js';

export type AuthorizationMatch = 'AND' | 'OR';

const normalizePermissionCode = (permission: string): string =>
  permission.trim().replace(/:/g, '.');

const hasPermission = (
  granted: ReadonlySet<string>,
  required: string,
): boolean => {
  const normalizedRequired = normalizePermissionCode(required);
  if (granted.has(normalizedRequired)) return true;

  const separatorIndex = normalizedRequired.indexOf('.');
  if (separatorIndex <= 0 || separatorIndex === normalizedRequired.length - 1) {
    return false;
  }

  const domain = normalizedRequired.slice(0, separatorIndex);
  return granted.has(`${domain}.manage`);
};

@Injectable()
export class AuthorizationService {
  constructor(
    @Inject(USER_AUTHORIZATION_REPOSITORY)
    private readonly authorization: UserAuthorizationRepository,
  ) {}

  async resolve(userUuid: string): Promise<AuthorizationSnapshot> {
    const snapshot =
      await this.authorization.getAuthorizationSnapshot(userUuid);
    if (!snapshot) throw new ForbiddenException();
    return snapshot;
  }

  assertPermissions(
    snapshot: AuthorizationSnapshot,
    required: readonly string[],
    match: AuthorizationMatch,
  ): void {
    this.assertNonEmptyRequirement(required);

    const granted = new Set(
      snapshot.permissionCodes.map(normalizePermissionCode),
    );
    const allowed =
      match === 'AND'
        ? required.every((permission) => hasPermission(granted, permission))
        : required.some((permission) => hasPermission(granted, permission));

    if (!allowed) throw new ForbiddenException();
  }

  assertRoles(
    snapshot: AuthorizationSnapshot,
    required: readonly string[],
    match: AuthorizationMatch,
  ): void {
    this.assertNonEmptyRequirement(required);
    const granted = new Set(snapshot.roleCodes);
    const allowed =
      match === 'AND'
        ? required.every((role) => granted.has(role))
        : required.some((role) => granted.has(role));
    if (!allowed) throw new ForbiddenException();
  }

  private assertNonEmptyRequirement(required: readonly string[]): void {
    if (
      required.length === 0 ||
      required.some((value) => value.trim().length === 0)
    ) {
      throw new ForbiddenException();
    }
  }
}
