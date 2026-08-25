import type {
  UserEntity,
  UserStatus,
  UserUpdate,
} from '../entities/user.entity.js';

export interface CreateUserData {
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: UserStatus;
}

export type UserFilterField =
  | 'username'
  | 'email'
  | 'phone'
  | 'status'
  | 'isActive';
export type UserSortField =
  | 'uuid'
  | 'username'
  | 'email'
  | 'phone'
  | 'status'
  | 'createdAt'
  | 'updatedAt';

export interface UserListQuery {
  page: number;
  limit: number;
  filterField?: UserFilterField;
  filterValue?: string;
  sortBy: UserSortField;
  sortDirection: 'asc' | 'desc';
  search?: string;
}

export interface UserListResult {
  items: UserEntity[];
  total: number;
  page: number;
  limit: number;
}

export interface UserRepository {
  create(data: CreateUserData): Promise<UserEntity>;
  findByUuid(uuid: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findByUsername(username: string): Promise<UserEntity | null>;
  findByPhone(phone: string): Promise<UserEntity | null>;
  findDuplicateIdentity(
    data: CreateUserData,
    excludeUuid?: string,
  ): Promise<UserEntity | null>;
  list(query: UserListQuery): Promise<UserListResult>;
  update(uuid: string, changes: UserUpdate): Promise<UserEntity>;
  softDelete(uuid: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
