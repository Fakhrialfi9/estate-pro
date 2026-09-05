import type { SystemActivityRecord } from '../system.types.js';

export const SYSTEM_ACTIVITY_REPOSITORY = Symbol('SYSTEM_ACTIVITY_REPOSITORY');
export type SystemActivitySort = 'createdAt_asc' | 'createdAt_desc';
export type SystemActivityWrite = Omit<SystemActivityRecord, 'uuid' | 'createdAt'> & {
  uuid?: string;
  createdAt?: Date;
};

export interface SystemActivityRepository {
  append(input: SystemActivityWrite): Promise<SystemActivityRecord>;
  upsert(input: SystemActivityWrite): Promise<SystemActivityRecord>;
  appendBatch(input: readonly SystemActivityWrite[]): Promise<readonly SystemActivityRecord[]>;
  upsertBatch(input: readonly SystemActivityWrite[]): Promise<readonly SystemActivityRecord[]>;
  get(uuid: string): Promise<SystemActivityRecord | null>;
  list(input: {
    page: number;
    limit: number;
    actorUuid?: string;
    eventType?: string;
    category?: string;
    resourceType?: string;
    resourceUuid?: string;
    sort?: SystemActivitySort;
  }): Promise<{ items: readonly SystemActivityRecord[]; total: number }>;
}
