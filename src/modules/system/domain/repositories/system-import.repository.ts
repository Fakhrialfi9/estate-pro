import type { ImportState } from '../system-public.contracts.js';

export const SYSTEM_IMPORT_REPOSITORY = Symbol('SYSTEM_IMPORT_REPOSITORY');

export interface SystemImportJobRecord {
  uuid: string;
  actorUuid: string;
  filename: string;
  format: 'csv' | 'json';
  state: ImportState;
  preview: boolean;
  idempotencyKey: string | null;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  errors: readonly { row: number; field?: string; message: string }[];
  sourcePath: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemImportRepository {
  create(input: {
    uuid: string;
    actorUuid: string;
    filename: string;
    format: 'csv' | 'json';
    preview: boolean;
    idempotencyKey?: string | null;
    sourcePath: string | null;
    expiresAt: Date;
  }): Promise<SystemImportJobRecord>;
  findByUuid(uuid: string, actorUuid?: string): Promise<SystemImportJobRecord | null>;
  findByIdempotencyKey(key: string, actorUuid: string): Promise<SystemImportJobRecord | null>;
  update(
    uuid: string,
    input: Partial<
      Pick<
        SystemImportJobRecord,
        | 'state'
        | 'totalRows'
        | 'processedRows'
        | 'failedRows'
        | 'errors'
        | 'sourcePath'
        | 'expiresAt'
      >
    >,
  ): Promise<SystemImportJobRecord>;
  list(input: {
    actorUuid: string;
    page: number;
    limit: number;
    state?: ImportState;
  }): Promise<{ items: readonly SystemImportJobRecord[]; total: number }>;
}
