export interface AssignedPermissionSummary {
  uuid: string;
  name: string;
  code: string;
  module: string;
  domain: string;
  action: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RolePermissionListQuery {
  page: number;
  limit: number;
}

export interface RolePermissionListResult {
  items: AssignedPermissionSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface RolePermissionRepository {
  exists(roleUuid: string, permissionUuid: string): Promise<boolean>;
  assign(roleUuid: string, permissionUuid: string): Promise<void>;
  remove(roleUuid: string, permissionUuid: string): Promise<void>;
  listByRole(
    roleUuid: string,
    query: RolePermissionListQuery,
  ): Promise<RolePermissionListResult>;
}

export const ROLE_PERMISSION_REPOSITORY = Symbol('ROLE_PERMISSION_REPOSITORY');
