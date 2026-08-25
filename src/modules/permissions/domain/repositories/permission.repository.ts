import type {
  PermissionEntity,
  PermissionUpdate,
} from '../entities/permission.entity.js';

export type PermissionFilterField = 'module' | 'domain' | 'action' | 'isSystem';
export type PermissionSortField =
  | 'name'
  | 'code'
  | 'module'
  | 'domain'
  | 'action'
  | 'createdAt'
  | 'updatedAt';

export interface CreatePermissionData {
  name: string;
  module: string;
  domain: string;
  action: string;
}

export interface PermissionListQuery {
  page: number;
  limit: number;
  filterField?: PermissionFilterField;
  filterValue?: string;
  sortBy: PermissionSortField;
  sortDirection: 'asc' | 'desc';
}

export interface PermissionListResult {
  items: PermissionEntity[];
  total: number;
  page: number;
  limit: number;
}

export interface PermissionDependencyCount {
  roleAssignments: number;
}

export interface PermissionRepository {
  create(data: CreatePermissionData): Promise<PermissionEntity>;
  findByUuid(uuid: string): Promise<PermissionEntity | null>;
  findByCode(code: string): Promise<PermissionEntity | null>;
  findByResourceAction(
    module: string,
    domain: string,
    action: string,
  ): Promise<PermissionEntity | null>;
  list(query: PermissionListQuery): Promise<PermissionListResult>;
  update(uuid: string, changes: PermissionUpdate): Promise<PermissionEntity>;
  delete(uuid: string): Promise<void>;
  getDependencyCount(uuid: string): Promise<PermissionDependencyCount>;
}

export const PERMISSION_REPOSITORY = Symbol('PERMISSION_REPOSITORY');
