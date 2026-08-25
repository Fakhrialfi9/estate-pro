import type { RoleEntity, RoleUpdate } from '../entities/role.entity.js';

export type RoleFilterField = 'name' | 'code' | 'isActive' | 'isSystem';
export type RoleSortField = 'name' | 'code' | 'createdAt' | 'updatedAt';

export interface CreateRoleData {
  name: string;
  code: string;
  description?: string | null;
}

export interface RoleListQuery {
  page: number;
  limit: number;
  filterField?: RoleFilterField;
  filterValue?: string;
  sortBy: RoleSortField;
  sortDirection: 'asc' | 'desc';
  search?: string;
}

export interface RoleListResult {
  items: RoleEntity[];
  total: number;
  page: number;
  limit: number;
}

export interface RoleDependencyCount {
  userAssignments: number;
  permissionAssignments: number;
}

export interface RoleRepository {
  create(data: CreateRoleData): Promise<RoleEntity>;
  findByUuid(uuid: string): Promise<RoleEntity | null>;
  findByCode(code: string): Promise<RoleEntity | null>;
  findByName(name: string): Promise<RoleEntity | null>;
  list(query: RoleListQuery): Promise<RoleListResult>;
  update(uuid: string, changes: RoleUpdate): Promise<RoleEntity>;
  delete(uuid: string): Promise<void>;
  getDependencyCount(uuid: string): Promise<RoleDependencyCount>;
}

export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');
