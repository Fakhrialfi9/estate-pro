import type { AuthenticatedPrincipal } from '../types/authenticated-principal.js';
import { UserProfileAccessDeniedError } from '../../domain/errors/user-profile.errors.js';

export class UserProfileOwnershipPolicy {
  assertCanManage(
    principal: AuthenticatedPrincipal,
    targetUserUuid: string,
  ): void {
    if (principal.sub === targetUserUuid) return;
    if (new Set(principal.permissions ?? []).has('users:manage')) return;
    throw new UserProfileAccessDeniedError();
  }
}
