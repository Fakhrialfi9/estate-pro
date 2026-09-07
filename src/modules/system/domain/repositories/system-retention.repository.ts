export const SYSTEM_RETENTION_REPOSITORY = Symbol('SYSTEM_RETENTION_REPOSITORY');

export interface SystemRetentionRepository {
  purgeActivity(before: Date, limit: number): Promise<number>;
  purgeAudit(before: Date, limit: number): Promise<number>;
}
