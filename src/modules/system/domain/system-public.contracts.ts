import type { SystemActivityRecord } from './system.types.js';

export interface SystemSettingListResult {
  readonly items: readonly Record<string, unknown>[];
  readonly meta: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface SystemSettingResult {
  readonly key: string;
  readonly scope: string;
  readonly scopeKey: string;
  readonly valueType: string;
  readonly value: string | number | boolean;
  readonly version?: number;
  readonly updatedAt?: Date;
}

export interface SystemSettingUpdateResult {
  readonly key: string;
  readonly value: string | number | boolean;
  readonly version: number;
  readonly updatedAt: Date;
}

export interface SystemSettingsContract {
  list(page: number, limit: number): Promise<SystemSettingListResult>;
  get(key: string): Promise<SystemSettingResult>;
  update(
    key: string,
    rawValue: string,
    actorUuid: string,
    expectedVersion?: number,
  ): Promise<SystemSettingUpdateResult>;
}

export interface SystemActivityAppendInput {
  readonly actorUuid?: string | null;
  readonly eventType: string;
  readonly category: string;
  readonly resourceType?: string | null;
  readonly resourceUuid?: string | null;
  readonly summary: string;
  readonly metadata?: Record<string, unknown>;
  readonly requestId?: string | null;
}

export interface SystemActivityListInput {
  readonly page: number;
  readonly limit: number;
  readonly actorUuid?: string;
  readonly eventType?: string;
  readonly category?: string;
  readonly resourceType?: string;
  readonly resourceUuid?: string;
}

export interface SystemActivityListResult {
  readonly items: readonly SystemActivityRecord[];
  readonly total: number;
}

export interface SystemActivityContract {
  append(input: SystemActivityAppendInput): Promise<SystemActivityRecord>;
  list(input: SystemActivityListInput): Promise<SystemActivityListResult>;
}

/**
 * System consumes notification behavior owned by Automation. The public
 * System contract intentionally does not expose the Automation persistence
 * model; the concrete response shape remains an application/API concern.
 */
export interface SystemNotificationsContract {
  list(
    userUuid: string,
    page: number,
    limit: number,
    unreadOnly: boolean,
  ): Promise<unknown>;
  markRead(userUuid: string, uuid: string): Promise<unknown>;
}

/**
 * System commands the Automation execution engine through its existing
 * public port. System does not own execution or persistence.
 */
export interface SystemJobsContract {
  list(
    input: { page: number; limit: number; state?: string },
    actorUuid: string,
  ): Promise<unknown>;
  get(uuid: string, actorUuid: string): Promise<unknown>;
  retry(uuid: string, actorUuid: string): Promise<unknown>;
  cancel(uuid: string, actorUuid: string): Promise<unknown>;
}
