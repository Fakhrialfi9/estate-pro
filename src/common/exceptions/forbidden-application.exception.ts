import { ForbiddenException } from '@nestjs/common';

import { ApplicationErrorCategory } from '../enums/application-error-category.enum.js';
import type { ApplicationErrorDetails } from '../types/application-error-details.type.js';

export class ForbiddenApplicationException extends ForbiddenException {
  readonly category = ApplicationErrorCategory.Application;

  constructor(
    readonly code: string,
    message: string,
    readonly details?: ApplicationErrorDetails,
  ) {
    super({ code, message });
    this.name = 'ForbiddenApplicationException';
  }
}
