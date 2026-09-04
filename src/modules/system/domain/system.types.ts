export type SystemSettingValueType = 'STRING' | 'INTEGER' | 'BOOLEAN' | 'URL';

export interface SystemSettingRecord {
  readonly uuid: string;
  readonly key: string;
  readonly scope: string;
  readonly scopeKey: string;
  readonly valueType: SystemSettingValueType;
  readonly value: string;
  readonly mutable: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SystemActivityRecord {
  readonly uuid: string;
  readonly actorUuid: string | null;
  readonly eventType: string;
  readonly category: string;
  readonly resourceType: string | null;
  readonly resourceUuid: string | null;
  readonly summary: string;
  readonly metadata: Record<string, unknown>;
  readonly requestId: string | null;
  readonly createdAt: Date;
}
