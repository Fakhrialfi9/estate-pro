import { DomainException } from '../../../../common/exceptions/domain.exception.js';

export class InvalidPropertyTypeException extends DomainException {
  constructor(message = 'Property type is invalid.') {
    super('INVALID_PROPERTY_TYPE', message);
  }
}

export class PropertyTypeNotFoundException extends DomainException {
  constructor() {
    super('PROPERTY_TYPE_NOT_FOUND', 'Property type was not found.');
  }
}

export class PropertyTypeAlreadyExistsException extends DomainException {
  constructor(field = 'code') {
    super(
      'PROPERTY_TYPE_ALREADY_EXISTS',
      `Property type ${field} is already in use.`,
    );
  }
}

export class PropertyTypeInUseException extends DomainException {
  constructor() {
    super(
      'PROPERTY_TYPE_IN_USE',
      'Property type cannot be deleted because it is still referenced.',
    );
  }
}
