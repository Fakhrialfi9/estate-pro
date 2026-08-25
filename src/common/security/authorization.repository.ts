export interface AuthorizationSnapshot {
  userUuid: string;
  roleCodes: readonly string[];
  permissionCodes: readonly string[];
}

export interface UserAuthorizationRepository {
  listPermissionCodes(userUuid: string): Promise<readonly string[]>;
  getAuthorizationSnapshot(
    userUuid: string,
  ): Promise<AuthorizationSnapshot | null>;
}

export const USER_AUTHORIZATION_REPOSITORY = Symbol(
  'USER_AUTHORIZATION_REPOSITORY',
);
