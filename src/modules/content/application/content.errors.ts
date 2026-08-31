export class ContentNotFoundError extends Error { constructor(message: string) { super(message); this.name = 'ContentNotFoundError'; } }
export class ContentConflictError extends Error { constructor(message: string) { super(message); this.name = 'ContentConflictError'; } }
export class ContentValidationError extends Error { constructor(message: string) { super(message); this.name = 'ContentValidationError'; } }
export class ContentConcurrencyError extends Error { constructor(message = 'The resource was modified by another request') { super(message); this.name = 'ContentConcurrencyError'; } }
