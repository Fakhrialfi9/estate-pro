import type { Readable } from 'node:stream';
export const SYSTEM_ARTIFACT_STORAGE = Symbol('SYSTEM_ARTIFACT_STORAGE');
export interface SystemArtifactStorage {
  put(id:string,data:Buffer,extension:string):Promise<{path:string;expiresAt?:Date}>;
  read(path:string):Promise<Buffer>;
  remove(path:string):Promise<void>;
  stream(path:string):Readable;
}
