import type { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { UserEntity } from '../../domain/entities/user.entity.js';

type AuthenticationUserRecord = NonNullable<
  Awaited<ReturnType<PrismaService['authenticationUser']['findFirst']>>
>;

export const PrismaUserMapper = {
  toDomain(record: AuthenticationUserRecord): UserEntity {
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

  toPersistence(data: {
    username?: string | null;
    email?: string | null;
    phone?: string | null;
    status?: string;
    isActive?: boolean;
  }) {
    return {
      ...(data.username !== undefined ? { username: data.username } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    };
  },
};
