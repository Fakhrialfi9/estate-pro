import type { UserStatus } from '../../modules/users/domain/entities/user.entity.js';

export interface UserPublicSnapshot {
  readonly uuid: string;
  readonly status: UserStatus;
  readonly isActive: boolean;
  readonly deletedAt: Date | null;
}

export interface UserPublicPort {
  getUser(uuid: string): Promise<UserPublicSnapshot>;
}

export const USER_PUBLIC_PORT = Symbol('USER_PUBLIC_PORT');
