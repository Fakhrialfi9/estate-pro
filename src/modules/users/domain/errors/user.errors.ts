export class UserNotFoundError extends Error {
  constructor() {
    super('User not found');
    this.name = 'UserNotFoundError';
  }
}

export class DuplicateUserError extends Error {
  constructor() {
    super('User identity is already in use');
    this.name = 'DuplicateUserError';
  }
}

export class InvalidUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUserError';
  }
}
