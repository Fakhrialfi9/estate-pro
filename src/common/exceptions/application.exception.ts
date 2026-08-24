import { ApplicationErrorCategory } from '../enums/application-error-category.enum.js';
import type { ApplicationErrorDetails } from '../types/application-error-details.type.js';

export class ApplicationException extends Error {
  readonly category = ApplicationErrorCategory.Application;

  constructor(
    readonly code: string,
    message: string,
    readonly details?: ApplicationErrorDetails,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApplicationException';
  }
}
