import { ApplicationException } from '../../../../common/exceptions/application.exception.js';

export class InvalidUserRoleIdentifierException extends ApplicationException {
  constructor() {
    super(
      'INVALID_USER_ROLE_IDENTIFIER',
      'User and role identifiers must be valid UUIDs.',
    );
  }
}

export class UserTargetNotFoundException extends ApplicationException {
  constructor() {
    super('USER_NOT_FOUND', 'User not found.');
  }
}

export class UserRoleNotFoundException extends ApplicationException {
  constructor() {
    super('USER_ROLE_NOT_FOUND', 'User role assignment not found.');
  }
}

export class UserRoleAlreadyExistsException extends ApplicationException {
  constructor() {
    super('USER_ROLE_ALREADY_EXISTS', 'The user already has this role.');
  }
}

export class UserRoleAssignmentForbiddenException extends ApplicationException {
  constructor() {
    super(
      'USER_ROLE_ASSIGNMENT_FORBIDDEN',
      'You are not authorized to assign roles.',
    );
  }
}

export class UserRoleRemovalForbiddenException extends ApplicationException {
  constructor() {
    super(
      'USER_ROLE_REMOVAL_FORBIDDEN',
      'You are not authorized to remove roles.',
    );
  }
}

export class PrivilegedRoleAssignmentForbiddenException extends ApplicationException {
  constructor() {
    super(
      'PRIVILEGED_ROLE_ASSIGNMENT_FORBIDDEN',
      'The selected protected role requires protected role-management permission.',
    );
  }
}
