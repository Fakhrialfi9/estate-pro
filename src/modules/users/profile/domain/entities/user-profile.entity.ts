export interface UserProfileSnapshot {
  id: string;
  userUuid: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  avatarThumbnailUrl: string | null;
  timezone: string;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfileUpdate {
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  avatarThumbnailUrl?: string | null;
  timezone?: string;
  locale?: string;
}

export class UserProfileEntity {
  private constructor(private snapshot: UserProfileSnapshot) {}

  static create(snapshot: UserProfileSnapshot): UserProfileEntity {
    UserProfileEntity.validateSnapshot(snapshot);
    return new UserProfileEntity({ ...snapshot });
  }

  get id(): string {
    return this.snapshot.id;
  }

  get userUuid(): string {
    return this.snapshot.userUuid;
  }

  get firstName(): string | null {
    return this.snapshot.firstName;
  }

  get lastName(): string | null {
    return this.snapshot.lastName;
  }

  get imageUrl(): string | null {
    return this.snapshot.imageUrl;
  }

  get avatarThumbnailUrl(): string | null {
    return this.snapshot.avatarThumbnailUrl;
  }

  get timezone(): string {
    return this.snapshot.timezone;
  }

  get locale(): string {
    return this.snapshot.locale;
  }

  get createdAt(): Date {
    return this.snapshot.createdAt;
  }

  get updatedAt(): Date {
    return this.snapshot.updatedAt;
  }

  update(changes: UserProfileUpdate): void {
    if (changes.firstName !== undefined) this.snapshot.firstName = changes.firstName;
    if (changes.lastName !== undefined) this.snapshot.lastName = changes.lastName;
    if (changes.imageUrl !== undefined) this.snapshot.imageUrl = changes.imageUrl;
    if (changes.avatarThumbnailUrl !== undefined) {
      this.snapshot.avatarThumbnailUrl = changes.avatarThumbnailUrl;
    }
    if (changes.timezone !== undefined) this.snapshot.timezone = changes.timezone;
    if (changes.locale !== undefined) this.snapshot.locale = changes.locale;

    UserProfileEntity.validateSnapshot(this.snapshot);
  }

  toSnapshot(): UserProfileSnapshot {
    return { ...this.snapshot };
  }

  private static validateSnapshot(snapshot: UserProfileSnapshot): void {
    if (!/^\d+$/.test(snapshot.id)) throw new Error('Invalid profile identifier');
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        snapshot.userUuid,
      )
    ) {
      throw new Error('Invalid user UUID');
    }
    UserProfileEntity.validateOptionalString(snapshot.firstName, 100, 'firstName');
    UserProfileEntity.validateOptionalString(snapshot.lastName, 100, 'lastName');
    UserProfileEntity.validateOptionalString(snapshot.imageUrl, 500, 'imageUrl');
    UserProfileEntity.validateOptionalString(
      snapshot.avatarThumbnailUrl,
      500,
      'avatarThumbnailUrl',
    );
    if (!snapshot.timezone.trim() || snapshot.timezone.length > 100) {
      throw new Error('Invalid timezone');
    }
    if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(snapshot.locale)) {
      throw new Error('Invalid locale');
    }
  }

  private static validateOptionalString(
    value: string | null,
    maxLength: number,
    field: string,
  ): void {
    if (value !== null && value.length > maxLength) {
      throw new Error(`Invalid ${field}`);
    }
  }
}
