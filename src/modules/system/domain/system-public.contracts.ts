import type {
  SystemActivityRecord,
  SystemSettingValueType,
} from './system.types.js';

type Scalar = string | number | boolean;

export interface SystemSettingResponse {
  readonly key: string;
  readonly scope: string;
  readonly scopeKey: string;
  readonly valueType: SystemSettingValueType;
  readonly value: Scalar;
  readonly version?: number;
  readonly updatedAt?: Date;
}

export interface SystemSettingListResult {
  readonly items: readonly SystemSettingResponse[];
  readonly meta: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface SystemSettingUpdateResult {
  readonly key: string;
  readonly value: Scalar;
  readonly version: number;
  readonly updatedAt: Date;
}

export interface SystemSettingsContract {
  list(page: number, limit: number): Promise<SystemSettingListResult>;
  get(key: string): Promise<SystemSettingResponse>;
  update(
    key: string,
    rawValue: string,
    actorUuid: string,
    expectedVersion?: number,
  ): Promise<SystemSettingUpdateResult>;
}

export interface SystemActivityAppendInput {
  readonly uuid?: string;
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
  get(uuid: string): Promise<SystemActivityRecord>;
  list(input: SystemActivityListInput): Promise<SystemActivityListResult>;
}

export interface SystemNotificationsContract {
  list(
    userUuid: string,
    page: number,
    limit: number,
    unreadOnly: boolean,
  ): Promise<unknown>;
  markRead(userUuid: string, uuid: string): Promise<unknown>;
  markAllRead(userUuid: string): Promise<{ updated: number }>;
}

export interface SystemJobsContract {
  list(
    input: { page: number; limit: number; state?: string },
    actorUuid: string,
  ): Promise<unknown>;
  get(uuid: string, actorUuid: string): Promise<unknown>;
  retry(uuid: string, actorUuid: string): Promise<unknown>;
  cancel(uuid: string, actorUuid: string): Promise<unknown>;
}

export type ImportFormat = 'csv' | 'json';
export type ImportState =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'RETRYABLE';

export interface ImportRequest {
  readonly filename: string;
  readonly contentBase64: string;
  readonly format?: ImportFormat;
  readonly idempotencyKey?: string;
  readonly preview?: boolean;
}

export interface ImportResult {
  readonly uuid: string;
  readonly state: ImportState;
  readonly totalRows: number;
  readonly processedRows: number;
  readonly failedRows: number;
  readonly errors: readonly { row: number; field?: string; message: string }[];
  readonly preview: boolean;
}

export interface ExportRequest {
  readonly entity: 'system_activity';
  readonly format: 'csv' | 'json';
  readonly limit?: number;
  readonly actorUuid: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly category?: string;
  readonly eventType?: string;
}

export type ExportState =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export interface ExportResult {
  readonly uuid: string;
  readonly state: ExportState;
  readonly format: 'csv' | 'json';
  readonly rows: number;
  readonly processedRows?: number;
  readonly estimatedRows?: number | null;
  readonly expiresAt: Date;
  readonly downloadToken?: string;
}
