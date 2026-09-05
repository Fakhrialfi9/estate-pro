export type CacheStats = Readonly<{
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  keys: number;
}>;

export const SYSTEM_CACHE = Symbol('SYSTEM_CACHE');

export interface SystemCachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  invalidateNamespace(namespace: string): Promise<number>;
  clear(): Promise<void>;
  stats(): Promise<CacheStats>;
  health(): Promise<{ ok: boolean; code: string }>;
}
