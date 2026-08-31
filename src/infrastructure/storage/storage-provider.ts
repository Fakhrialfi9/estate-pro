export interface StorageObject {
  key: string;
  publicUrl: string | null;
}

export interface StorageProvider {
  put(input: {
    key: string;
    content: Buffer;
    contentType: string;
  }): Promise<StorageObject>;
  delete(key: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
