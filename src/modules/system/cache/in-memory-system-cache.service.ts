import { Injectable } from '@nestjs/common';
import type { CacheStats, SystemCachePort } from './system-cache.port.js';

type Entry = {
  value: unknown;
  expiresAt: number;
  namespace: string;
};

const KEY_PATTERN = /^[a-z][a-z0-9_-]{0,31}:[a-zA-Z0-9._:-]{1,220}$/;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class InMemorySystemCacheService implements SystemCachePort {
  private readonly store = new Map<string, Entry>();
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private deletes = 0;
  private evictions = 0;

  get<T>(key: string): Promise<T | null> {
    this.validateKey(key);
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return Promise.resolve(null);
    }
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      this.evictions += 1;
      this.misses += 1;
      return Promise.resolve(null);
    }
    this.hits += 1;
    return Promise.resolve(structuredClone(entry.value) as T);
  }

  set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.validateKey(key);
    if (!Number.isFinite(ttlMs) || ttlMs < 1 || ttlMs > MAX_TTL_MS)
      return Promise.reject(
        new Error(`Cache TTL must be between 1ms and ${MAX_TTL_MS}ms`),
      );
    const namespace = key.slice(0, key.indexOf(':'));
    this.store.set(key, {
      value: structuredClone(value),
      expiresAt: Date.now() + Math.trunc(ttlMs),
      namespace,
    });
    this.sets += 1;
    return Promise.resolve();
  }

  delete(key: string): Promise<boolean> {
    this.validateKey(key);
    const deleted = this.store.delete(key);
    if (deleted) this.deletes += 1;
    return Promise.resolve(deleted);
  }

  invalidateNamespace(namespace: string): Promise<number> {
    this.validateNamespace(namespace);
    let count = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.namespace === namespace) {
        this.store.delete(key);
        count += 1;
      }
    }
    this.deletes += count;
    return Promise.resolve(count);
  }

  clear(): Promise<void> {
    this.store.clear();
    this.deletes += 1;
    return Promise.resolve();
  }

  stats(): Promise<CacheStats> {
    this.purgeExpired();
    return Promise.resolve({
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      deletes: this.deletes,
      evictions: this.evictions,
      keys: this.store.size,
    });
  }

  health(): Promise<{ ok: boolean; code: string }> {
    return Promise.resolve({ ok: true, code: 'IN_MEMORY' });
  }

  private purgeExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
        this.evictions += 1;
      }
    }
  }

  private validateKey(key: string) {
    if (!KEY_PATTERN.test(key)) throw new Error('Invalid cache key');
  }

  private validateNamespace(namespace: string) {
    if (!/^[a-z][a-z0-9_-]{0,31}$/.test(namespace))
      throw new Error('Invalid cache namespace');
  }
}
