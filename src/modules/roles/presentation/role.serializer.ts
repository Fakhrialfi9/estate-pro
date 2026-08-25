import type { RoleEntity } from '../domain/entities/role.entity.js';

export interface RoleResponse {
  uuid: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoleListResponse {
  items: RoleResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pageCount: number;
  };
}

export const RoleSerializer = {
  one(role: RoleEntity): RoleResponse {
    return {
      uuid: role.uuid,
      name: role.name,
      code: role.code,
      description: role.description,
      isActive: role.isActive,
      isSystem: role.isSystem,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  },

  list(
    items: RoleEntity[],
    total: number,
    page: number,
    limit: number,
  ): RoleListResponse {
    return {
      items: items.map((role) => RoleSerializer.one(role)),
      meta: { total, page, limit, pageCount: Math.ceil(total / limit) },
    };
  },
};
