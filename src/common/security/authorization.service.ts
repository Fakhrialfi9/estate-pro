import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  USER_AUTHORIZATION_REPOSITORY,
  type AuthorizationSnapshot,
  type UserAuthorizationRepository,
} from './authorization.repository.js';

export type AuthorizationMatch = 'AND' | 'OR';

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
    const granted = new Set(snapshot.permissionCodes);
    const allowed =
      match === 'AND'
        ? required.every((permission) => granted.has(permission))
        : required.some((permission) => granted.has(permission));
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
