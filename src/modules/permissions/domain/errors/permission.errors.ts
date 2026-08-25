import { ApplicationException } from '../../../../common/exceptions/application.exception.js';

export class PermissionNotFoundException extends ApplicationException {
  constructor() {
    super('PERMISSION_NOT_FOUND', 'Permission not found.');
  }
}

export class PermissionAlreadyExistsException extends ApplicationException {
  constructor() {
    super(
      'PERMISSION_ALREADY_EXISTS',
      'A permission with the same identifier already exists.',
    );
  }
}

export class PermissionResourceActionAlreadyExistsException extends ApplicationException {
  constructor() {
    super(
      'PERMISSION_RESOURCE_ACTION_ALREADY_EXISTS',
      'A permission with the same resource and action already exists.',
    );
  }
}

export class PermissionInUseException extends ApplicationException {
  constructor() {
    super(
      'PERMISSION_IN_USE',
      'Permission is still referenced and cannot be deleted.',
    );
  }
}

export class SystemPermissionProtectedException extends ApplicationException {
  constructor() {
    super('SYSTEM_PERMISSION_PROTECTED', 'System permission is protected.');
  }
}

export class PermissionUpdateNotAllowedException extends ApplicationException {
  constructor() {
    super(
      'PERMISSION_UPDATE_NOT_ALLOWED',
      'Permission update is not allowed by policy.',
    );
  }
}

export class PermissionDeleteNotAllowedException extends ApplicationException {
  constructor() {
    super(
      'PERMISSION_DELETE_NOT_ALLOWED',
      'Permission deletion is not allowed by policy.',
    );
  }
}

export class UnauthorizedPermissionOperationException extends ApplicationException {
  constructor() {
    super(
      'UNAUTHORIZED_PERMISSION_OPERATION',
      'Authentication is required for this operation.',
    );
  }
}

export class ForbiddenPermissionOperationException extends ApplicationException {
  constructor() {
    super(
      'FORBIDDEN_PERMISSION_OPERATION',
      'You are not authorized to manage permissions.',
    );
  }
}

export class InvalidPermissionException extends ApplicationException {
  constructor(code: string, message: string) {
    super(code, message);
  }
}
