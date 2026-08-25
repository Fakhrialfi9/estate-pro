import type { UserEntity } from '../../domain/entities/user.entity.js';

export interface UserResponse {
  uuid: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export const serializeUser = (user: UserEntity): UserResponse => ({
  uuid: user.uuid,
  username: user.username,
  email: user.email,
  phone: user.phone,
  status: user.status,
  isActive: user.isActive,
  isVerified: user.isVerified,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});

export const serializeUserList = (users: UserEntity[]) => users.map(serializeUser);
