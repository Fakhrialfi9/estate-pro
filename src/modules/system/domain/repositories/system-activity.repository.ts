import type { SystemActivityRecord } from '../system.types.js';

export const SYSTEM_ACTIVITY_REPOSITORY = Symbol('SYSTEM_ACTIVITY_REPOSITORY');

export interface SystemActivityRepository {
  append(
    input: Omit<SystemActivityRecord, 'uuid' | 'createdAt'> & {
      uuid?: string;
      createdAt?: Date;
    },
  ): Promise<SystemActivityRecord>;
  list(input: {
    page: number;
    limit: number;
    actorUuid?: string;
    eventType?: string;
    category?: string;
    resourceType?: string;
    resourceUuid?: string;
  }): Promise<{ items: readonly SystemActivityRecord[]; total: number }>;
}
