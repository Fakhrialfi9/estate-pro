import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../infrastructure/database/prisma/prisma.service.js';
import type { UserProfileUpdate } from '../../domain/entities/user-profile.entity.js';
import type {
  CreateUserProfileData,
  UserProfileRepository,
} from '../../domain/repositories/user-profile.repository.js';
import {
  DuplicateUserProfileError,
  UserProfileNotFoundError,
} from '../../domain/errors/user-profile.errors.js';
import { UserNotFoundError } from '../../domain/errors/user.errors.js';
import {
  PrismaUserProfileMapper,
  type UserProfilePersistenceData,
  type UserProfilePersistenceRecord,
} from './prisma-user-profile.mapper.js';

type UserDelegate = {
  findUnique(args: {
    where: { uuid: string };
    select: { id: true };
  }): Promise<{ id: bigint } | null>;
};

type ProfileDelegate = {
  findUnique(args: {
    where: { userId: bigint };
  }): Promise<UserProfilePersistenceRecord | null>;
  create(args: {
    data: UserProfilePersistenceData;
  }): Promise<UserProfilePersistenceRecord>;
  update(args: {
    where: { userId: bigint };
    data: UserProfilePersistenceData;
  }): Promise<UserProfilePersistenceRecord>;
};

type PrismaPersistenceClient = {
  authenticationUser: UserDelegate;
  authenticationUserProfile: ProfileDelegate;
};

@Injectable()
export class PrismaUserProfileRepository implements UserProfileRepository {
  private readonly users: UserDelegate;
  private readonly profiles: ProfileDelegate;

  constructor(prisma: PrismaService) {
    const client = prisma as unknown as PrismaPersistenceClient;
    this.users = client.authenticationUser;
    this.profiles = client.authenticationUserProfile;
  }

  async create(data: CreateUserProfileData) {
    const user = await this.users.findUnique({
      where: { uuid: data.userUuid },
      select: { id: true },
    });
    if (!user) throw new UserNotFoundError();

    const existing = await this.profiles.findUnique({
      where: { userId: user.id },
    });
    if (existing) throw new DuplicateUserProfileError();

    try {
      const record = await this.profiles.create({
        data: PrismaUserProfileMapper.toPersistence(
          {
            ...(data.firstName !== undefined
              ? { firstName: data.firstName }
              : {}),
            ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
            ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
            ...(data.avatarThumbnailUrl !== undefined
              ? { avatarThumbnailUrl: data.avatarThumbnailUrl }
              : {}),
            ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
            ...(data.locale !== undefined ? { locale: data.locale } : {}),
          },
          user.id,
        ),
      });
      return PrismaUserProfileMapper.toDomain(record, data.userUuid);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new DuplicateUserProfileError();
      }
      throw error;
    }
  }

  async findByUserUuid(userUuid: string) {
    const user = await this.users.findUnique({
      where: { uuid: userUuid },
      select: { id: true },
    });
    if (!user) return null;

    const record = await this.profiles.findUnique({
      where: { userId: user.id },
    });
    return record ? PrismaUserProfileMapper.toDomain(record, userUuid) : null;
  }

  async updateByUserUuid(userUuid: string, changes: UserProfileUpdate) {
    const user = await this.users.findUnique({
      where: { uuid: userUuid },
      select: { id: true },
    });
    if (!user) throw new UserNotFoundError();

    try {
      const record = await this.profiles.update({
        where: { userId: user.id },
        data: PrismaUserProfileMapper.toPersistence(changes, user.id),
      });
      return PrismaUserProfileMapper.toDomain(record, userUuid);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'P2025') {
        throw new UserProfileNotFoundError();
      }
      throw error;
    }
  }
}
