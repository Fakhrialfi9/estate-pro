import { ApplicationException } from '../../../../common/exceptions/application.exception.js';

export class RolePermissionAlreadyExistsException extends ApplicationException {
  constructor() {
    super(
      'ROLE_PERMISSION_ALREADY_EXISTS',
      'The permission is already assigned to the role.',
    );
  }
}

export class RolePermissionNotFoundException extends ApplicationException {
  constructor() {
    super('ROLE_PERMISSION_NOT_FOUND', 'Role permission assignment not found.');
  }
}

export class RolePermissionAssignmentForbiddenException extends ApplicationException {
  constructor() {
    super(
      'ROLE_PERMISSION_ASSIGNMENT_FORBIDDEN',
      'You are not authorized to assign permissions to roles.',
    );
  }
}

export class RolePermissionRemovalForbiddenException extends ApplicationException {
  constructor() {
    super(
      'ROLE_PERMISSION_REMOVAL_FORBIDDEN',
      'You are not authorized to remove permissions from roles.',
    );
  }
}

export class InvalidRolePermissionIdentifierException extends ApplicationException {
  constructor(field: 'role' | 'permission') {
    super(
      `INVALID_${field.toUpperCase()}_IDENTIFIER`,
      `${field === 'role' ? 'Role' : 'Permission'} identifier is invalid.`,
    );
  }
}
