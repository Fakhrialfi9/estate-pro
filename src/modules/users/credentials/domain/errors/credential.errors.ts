export class CredentialAlreadyExistsError extends Error {
  constructor() {
    super('Credential already exists');
    this.name = 'CredentialAlreadyExistsError';
  }
}

export class CredentialNotFoundError extends Error {
  constructor() {
    super('Credential not found');
    this.name = 'CredentialNotFoundError';
  }
}

export class ConcurrentPasswordChangeError extends Error {
  constructor() {
    super('Password was changed concurrently');
    this.name = 'ConcurrentPasswordChangeError';
  }
}

export class InvalidPasswordError extends Error {
  constructor(message = 'Invalid password') {
    super(message);
    this.name = 'InvalidPasswordError';
  }
}

export class InvalidPasswordConfirmationError extends Error {
  constructor() {
    super('Password confirmation does not match');
    this.name = 'InvalidPasswordConfirmationError';
  }
}

export class CurrentPasswordVerificationError extends Error {
  constructor() {
    super('Current password verification failed');
    this.name = 'CurrentPasswordVerificationError';
  }
}

export class ResetTokenInvalidError extends Error {
  constructor() {
    super('Password reset token is invalid or expired');
    this.name = 'ResetTokenInvalidError';
  }
}
