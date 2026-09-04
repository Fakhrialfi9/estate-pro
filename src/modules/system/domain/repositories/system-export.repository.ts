import type { ExportFormat, ExportState } from '../system-public.contracts.js';

export const SYSTEM_EXPORT_REPOSITORY = Symbol('SYSTEM_EXPORT_REPOSITORY');

export interface SystemExportJobRecord {
  uuid: string;
  actorUuid: string;
  entity: 'system_activity';
  format: ExportFormat;
  state: ExportState;
  filters: Record<string, unknown>;
  artifactPath: string | null;
  downloadTokenHash: string | null;
  rows: number;
  estimatedRows: number | null;
  processedRows: number;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelRequested: boolean;
  artifactBytes: bigint | null;
  expiresAt: Date;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemExportRepository {
  create(input: {
    uuid: string;
    actorUuid: string;
    entity: 'system_activity';
    format: ExportFormat;
    filters: Record<string, unknown>;
    expiresAt: Date;
    estimatedRows?: number | null;
  }): Promise<SystemExportJobRecord>;
  findByUuid(uuid: string, actorUuid?: string): Promise<SystemExportJobRecord | null>;
  findByTokenHash(uuid: string, tokenHash: string): Promise<SystemExportJobRecord | null>;
  countRunning(): Promise<number>;
  claimQueued(workerId: string): Promise<SystemExportJobRecord | null>;
  update(uuid: string, input: Partial<Pick<SystemExportJobRecord, 'state' | 'artifactPath' | 'downloadTokenHash' | 'rows' | 'estimatedRows' | 'processedRows' | 'completedAt' | 'cancelledAt' | 'cancelRequested' | 'artifactBytes' | 'expiresAt' | 'errorMessage'>>): Promise<SystemExportJobRecord>;
  list(input: { actorUuid: string; page: number; limit: number; state?: ExportState }): Promise<{ items: readonly SystemExportJobRecord[]; total: number }>;
  listExpired(now: Date, limit: number): Promise<readonly SystemExportJobRecord[]>;
  deleteMany(uuids: readonly string[]): Promise<void>;
}
