export class DuplicateUserProfileError extends Error {
  constructor() {
    super('User profile already exists');
    this.name = 'DuplicateUserProfileError';
  }
}

export class UserProfileNotFoundError extends Error {
  constructor() {
    super('User profile not found');
    this.name = 'UserProfileNotFoundError';
  }
}

export class InvalidUserProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUserProfileError';
  }
}

export class UserProfileAccessDeniedError extends Error {
  constructor() {
    super('You are not allowed to manage this profile');
    this.name = 'UserProfileAccessDeniedError';
  }
}
