import { ApplicationException } from '../../../../common/exceptions/application.exception.js';

export class RoleNotFoundException extends ApplicationException {
  constructor() { super('ROLE_NOT_FOUND', 'Role not found.'); }
}
export class RoleAlreadyExistsException extends ApplicationException {
  constructor() { super('ROLE_ALREADY_EXISTS', 'A role with the same name already exists.'); }
}
export class RoleCodeAlreadyExistsException extends ApplicationException {
  constructor() { super('ROLE_SLUG_ALREADY_EXISTS', 'A role with the same identifier already exists.'); }
}
export class RoleInUseException extends ApplicationException {
  constructor() { super('ROLE_IN_USE', 'Role is still referenced and cannot be deleted.'); }
}
export class SystemRoleProtectedException extends ApplicationException {
  constructor() { super('SYSTEM_ROLE_PROTECTED', 'System role is protected.'); }
}
export class RoleUpdateNotAllowedException extends ApplicationException {
  constructor() { super('ROLE_UPDATE_NOT_ALLOWED', 'Role update is not allowed by policy.'); }
}
export class RoleDeleteNotAllowedException extends ApplicationException {
  constructor() { super('ROLE_DELETE_NOT_ALLOWED', 'Role deletion is not allowed by policy.'); }
}
export class UnauthorizedRoleOperationException extends ApplicationException {
  constructor() { super('UNAUTHORIZED_ROLE_OPERATION', 'Authentication is required for this operation.'); }
}
export class ForbiddenRoleOperationException extends ApplicationException {
  constructor() { super('FORBIDDEN_ROLE_OPERATION', 'You are not authorized to manage roles.'); }
}
export class InvalidRoleException extends ApplicationException {
  constructor(message: string) { super('INVALID_ROLE', message); }
}
