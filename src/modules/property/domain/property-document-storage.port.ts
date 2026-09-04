export interface PropertyDocumentStoragePort {
  /**
   * Return a short-lived, authenticated URL for a private object.
   * The application never exposes storage credentials or raw provider internals.
   */
  createReadUrl(storageKey: string, expiresInSeconds: number): Promise<string>;
  deleteObject(storageKey: string): Promise<void>;
}

export const PROPERTY_DOCUMENT_STORAGE = Symbol('PROPERTY_DOCUMENT_STORAGE');
