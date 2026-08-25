import type { UserRoleEntity } from '../entities/user-role.entity.js';

export interface UserRoleListQuery {
  page: number;
  limit: number;
}

export interface UserRoleListResult {
  items: UserRoleEntity[];
  total: number;
}

export interface AssignUserRoleData {
  userUuid: string;
  roleUuid: string;
  assignedByUuid: string;
}

export interface RemoveUserRoleData {
  userUuid: string;
  roleUuid: string;
}

export interface UserRoleRepository {
  findByUserAndRole(
    userUuid: string,
    roleUuid: string,
  ): Promise<UserRoleEntity | null>;
  assign(data: AssignUserRoleData): Promise<UserRoleEntity>;
  remove(data: RemoveUserRoleData): Promise<UserRoleEntity>;
  listByUser(
    userUuid: string,
    query: UserRoleListQuery,
  ): Promise<UserRoleListResult>;
}

export const USER_ROLE_REPOSITORY = Symbol('USER_ROLE_REPOSITORY');
