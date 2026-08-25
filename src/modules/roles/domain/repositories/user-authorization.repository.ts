export interface UserAuthorizationRepository {
  listPermissionCodes(userUuid: string): Promise<readonly string[]>;
}

export const USER_AUTHORIZATION_REPOSITORY = Symbol(
  'USER_AUTHORIZATION_REPOSITORY',
);
