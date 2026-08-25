export interface UserRoleTarget {
  uuid: string;
}

export interface UserRoleTargetRepository {
  findByUuid(userUuid: string): Promise<UserRoleTarget | null>;
}

export const USER_ROLE_TARGET_REPOSITORY = Symbol(
  'USER_ROLE_TARGET_REPOSITORY',
);
