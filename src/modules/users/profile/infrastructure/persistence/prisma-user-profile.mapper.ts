import { UserProfileEntity } from '../../domain/entities/user-profile.entity.js';

export interface UserProfilePersistenceRecord {
  id: bigint;
  userId: bigint;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  avatarThumbnailUrl: string | null;
  timezone: string;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfilePersistenceData {
  userId: bigint;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  avatarThumbnailUrl?: string | null;
  timezone?: string;
  locale?: string;
}

export class PrismaUserProfileMapper {
  static toDomain(
    record: UserProfilePersistenceRecord,
    userUuid: string,
  ): UserProfileEntity {
    return UserProfileEntity.create({
      id: record.id.toString(),
      userUuid,
      firstName: record.firstName,
      lastName: record.lastName,
      imageUrl: record.imageUrl,
      avatarThumbnailUrl: record.avatarThumbnailUrl,
      timezone: record.timezone,
      locale: record.locale,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(
    data: Partial<Omit<UserProfilePersistenceData, 'userId'>>,
    userId: bigint,
  ): UserProfilePersistenceData {
    return { userId, ...data };
  }
}
