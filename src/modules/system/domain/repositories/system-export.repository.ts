export const SYSTEM_EXPORT_REPOSITORY = Symbol('SYSTEM_EXPORT_REPOSITORY');

export interface SystemExportJobRecord {
  uuid: string;
  actorUuid: string;
  entity: 'system_activity';
  format: 'csv' | 'json';
  state: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  filters: Record<string, unknown>;
  artifactPath: string | null;
  downloadTokenHash: string | null;
  rows: number;
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
    format: 'csv' | 'json';
    filters: Record<string, unknown>;
    expiresAt: Date;
  }): Promise<SystemExportJobRecord>;
  findByUuid(
    uuid: string,
    actorUuid?: string,
  ): Promise<SystemExportJobRecord | null>;
  findByTokenHash(
    uuid: string,
    tokenHash: string,
  ): Promise<SystemExportJobRecord | null>;
  update(
    uuid: string,
    input: Partial<
      Pick<
        SystemExportJobRecord,
        | 'state'
        | 'artifactPath'
        | 'downloadTokenHash'
        | 'rows'
        | 'expiresAt'
        | 'errorMessage'
      >
    >,
  ): Promise<SystemExportJobRecord>;
  list(input: {
    actorUuid: string;
    page: number;
    limit: number;
    state?: SystemExportJobRecord['state'];
  }): Promise<{ items: readonly SystemExportJobRecord[]; total: number }>;
}
