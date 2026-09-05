export const IMPORT_TARGET_FIELDS = [
  'eventType',
  'category',
  'summary',
  'resourceType',
  'resourceUuid',
  'metadata',
  'requestId',
] as const;

export type ImportTargetField = (typeof IMPORT_TARGET_FIELDS)[number];

export type ImportConflictStrategy = 'FAIL' | 'SKIP' | 'UPDATE' | 'UPSERT';
export type ImportTransactionStrategy = 'ROW' | 'BATCH' | 'ALL_OR_NOTHING';

export type ImportTransform =
  | 'trim'
  | 'lowercase'
  | 'uppercase'
  | 'null-if-empty'
  | 'number'
  | 'boolean'
  | 'date';

export interface ImportColumnMapping {
  readonly sourceColumn: string;
  readonly targetField: ImportTargetField;
  readonly required?: boolean;
}

export interface ImportFieldMapping {
  readonly targetField: ImportTargetField;
  readonly transforms: readonly ImportTransform[];
}
