export class MasterNotFoundError extends Error { constructor(message = 'Resource not found') { super(message); this.name = 'MasterNotFoundError'; } }
export class MasterConflictError extends Error { constructor(message = 'Resource conflict') { super(message); this.name = 'MasterConflictError'; } }
export class MasterInUseError extends Error { constructor(message = 'Resource is still referenced') { super(message); this.name = 'MasterInUseError'; } }
export class MasterHierarchyError extends Error { constructor(message = 'Invalid hierarchy') { super(message); this.name = 'MasterHierarchyError'; } }
export class MasterConcurrencyError extends Error { constructor(message = 'Resource was modified by another request') { super(message); this.name = 'MasterConcurrencyError'; } }
export class MasterStateError extends Error { constructor(message = 'Invalid state transition') { super(message); this.name = 'MasterStateError'; } }
