import { UserEntity } from '../../domain/entities/user.entity.js';

export interface UserPersistenceRecord {
  uuid: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface UserPersistenceData {
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string;
  isActive?: boolean;
  deletedAt?: Date | null;
}

export const PrismaUserMapper = {
  toDomain(record: UserPersistenceRecord): UserEntity {
    return UserEntity.create({
      uuid: record.uuid,
      username: record.username,
      email: record.email,
      phone: record.phone,
      status: record.status,
      isActive: record.isActive,
      isVerified: record.isVerified,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  },

  toPersistence(
    data: Omit<UserPersistenceData, 'deletedAt'>,
  ): UserPersistenceData {
    return {
      ...(data.username !== undefined ? { username: data.username } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    };
  },
};
