import type { SystemActivityRecord, SystemSettingValueType } from './system.types.js';

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
