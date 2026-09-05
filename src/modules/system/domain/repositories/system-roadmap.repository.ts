import type { IntegrationState } from '../integration/integration.contracts.js';
import type {
  IntegrationCredentialStatus,
  IntegrationCredentialType,
} from '../integration/integration-operation.contracts.js';
export const SYSTEM_ROADMAP_REPOSITORY = Symbol('SYSTEM_ROADMAP_REPOSITORY');
export type FeatureFlagRecord = {
  uuid: string;
  key: string;
  environment: string;
  description: string | null;
  enabled: boolean;
  rolloutPercentage: number;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};
export type ImportProfileRecord = {
  uuid: string;
  name: string;
  entity: string;
  version: number;
  format: string;
  columnMapping: Record<string, unknown>;
  fieldMapping: Record<string, unknown>;
  conflictStrategy: string;
  transactionStrategy: string;
  active: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
};
export type IntegrationCredentialRecord = {
  uuid: string;
  integrationId: bigint;
  credentialType: IntegrationCredentialType | string;
  secretRef: string | null;
  accessTokenRef: string | null;
  refreshTokenRef: string | null;
  version: number;
  status: IntegrationCredentialStatus | string;
  issuedAt: Date;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  lastUsedAt: Date | null;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  metadata: Record<string, unknown>;
};
export type IntegrationRuntimeRecord = {
  uuid: string;
  integrationId: bigint;
  circuitState: string;
  failureCount: number;
  successCount: number;
  openedAt: Date | null;
  halfOpenAt: Date | null;
  nextRetryAt: Date | null;
  syncDirection: string;
  syncCursor: string | null;
  lastSyncedAt: Date | null;
  requestMapping: Record<string, unknown>;
  responseMapping: Record<string, unknown>;
  lastHealthAt: Date | null;
  lastOperationAt: Date | null;
  lastOperationStatus: string | null;
  metadata: Record<string, unknown>;
};
export type IntegrationOperationRecord = {
  uuid: string;
  integrationId: bigint;
  operationKey: string;
  direction: string;
  idempotencyKey: string;
  attempt: number;
  maxAttempts: number;
  state: string;
  requestHash: string | null;
  responseHash: string | null;
  requestPayload: Record<string, unknown> | null;
  responsePayload: Record<string, unknown> | null;
  nextAttemptAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
};
export type IntegrationEventRecord = {
  uuid: string;
  integrationId: bigint;
  eventKey: string;
  eventName: string;
  eventVersion: number;
  payload: Record<string, unknown>;
  payloadHash: string;
  idempotencyKey: string | null;
  status: string;
  occurredAt: Date;
  processedAt: Date | null;
};
export type IntegrationConflictRecord = {
  uuid: string;
  integrationId: bigint;
  operationUuid: string | null;
  conflictKey: string;
  entityType: string;
  localVersion: string | null;
  remoteVersion: string | null;
  resolution: string;
  status: string;
  localPayload: Record<string, unknown> | null;
  remotePayload: Record<string, unknown> | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
};
export type IntegrationIdempotencyRecord = {
  uuid: string;
  integrationId: bigint;
  eventKey: string;
  eventName: string;
  eventVersion: number;
  payloadHash: string;
  status: string;
  attempt: number;
  processedAt: Date | null;
  lastErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};
export type OperationalAlertRuleRecord = {
  uuid: string;
  ruleKey: string;
  signal: string;
  severity: string;
  threshold: number;
  windowSeconds: number;
  cooldownSeconds: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};
export type OperationalAlertRecord = {
  uuid: string;
  alertKey: string;
  severity: string;
  status: string;
  message: string;
  dedupeKey: string;
  resourceType: string | null;
  resourceUuid: string | null;
  metadata: Record<string, unknown>;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
};
export interface SystemRoadmapRepository {
  featureFlag: {
    list(e?: string): Promise<readonly FeatureFlagRecord[]>;
    get(k: string, e: string): Promise<FeatureFlagRecord | null>;
    upsert(
      i: Omit<FeatureFlagRecord, 'createdAt' | 'updatedAt'>,
    ): Promise<FeatureFlagRecord>;
  };
  importProfile: {
    create(
      i: Omit<ImportProfileRecord, 'createdAt' | 'updatedAt'>,
    ): Promise<ImportProfileRecord>;
    list(e?: string, a?: boolean): Promise<readonly ImportProfileRecord[]>;
    get(u: string): Promise<ImportProfileRecord | null>;
    update(
      u: string,
      i: Partial<Omit<ImportProfileRecord, 'uuid' | 'createdAt' | 'updatedAt'>>,
    ): Promise<ImportProfileRecord>;
  };
  credential: {
    get(u: string): Promise<IntegrationCredentialRecord | null>;
    list(
      i: bigint,
      t?: string,
    ): Promise<readonly IntegrationCredentialRecord[]>;
    create(
      i: Omit<IntegrationCredentialRecord, 'issuedAt' | 'lastUsedAt'>,
    ): Promise<IntegrationCredentialRecord>;
    revoke(u: string, d: Date): Promise<IntegrationCredentialRecord>;
    markUsed(u: string, d: Date): Promise<IntegrationCredentialRecord>;
    rotate(
      u: string,
      i: {
        secretRef?: string | null;
        accessTokenRef?: string | null;
        refreshTokenRef?: string | null;
        accessTokenExpiresAt?: Date | null;
        refreshTokenExpiresAt?: Date | null;
        metadata?: Record<string, unknown>;
      },
    ): Promise<IntegrationCredentialRecord>;
  };
  runtime: {
    getOrCreate(i: bigint): Promise<IntegrationRuntimeRecord>;
    update(
      i: bigint,
      p: Partial<Omit<IntegrationRuntimeRecord, 'uuid' | 'integrationId'>>,
    ): Promise<IntegrationRuntimeRecord>;
  };
  operation: {
    getByIdempotency(
      i: bigint,
      k: string,
    ): Promise<IntegrationOperationRecord | null>;
    create(
      i: Omit<IntegrationOperationRecord, 'uuid'> & { uuid: string },
    ): Promise<IntegrationOperationRecord>;
    update(
      u: string,
      i: Partial<Omit<IntegrationOperationRecord, 'uuid'>>,
    ): Promise<IntegrationOperationRecord>;
    list(
      i: bigint,
      s?: string,
      l?: number,
    ): Promise<readonly IntegrationOperationRecord[]>;
  };
  event: {
    create(i: IntegrationEventRecord): Promise<IntegrationEventRecord>;
    getByKey(i: bigint, k: string): Promise<IntegrationEventRecord | null>;
    update(
      u: string,
      i: Partial<Omit<IntegrationEventRecord, 'uuid'>>,
    ): Promise<IntegrationEventRecord>;
    list(
      i: bigint,
      s?: string,
      l?: number,
    ): Promise<readonly IntegrationEventRecord[]>;
  };
  idempotency: {
    reserve(
      i: Omit<IntegrationIdempotencyRecord, 'createdAt' | 'updatedAt'>,
    ): Promise<{ record: IntegrationIdempotencyRecord; created: boolean }>;
    update(
      u: string,
      i: Partial<Omit<IntegrationIdempotencyRecord, 'uuid' | 'integrationId'>>,
    ): Promise<IntegrationIdempotencyRecord>;
  };
  conflict: {
    upsert(i: IntegrationConflictRecord): Promise<IntegrationConflictRecord>;
    get(i: bigint, k: string): Promise<IntegrationConflictRecord | null>;
    list(
      i: bigint,
      s?: string,
      l?: number,
    ): Promise<readonly IntegrationConflictRecord[]>;
    resolve(
      i: bigint,
      k: string,
      p: { resolution: string; resolvedBy: string },
    ): Promise<IntegrationConflictRecord>;
  };
  alertRule: {
    list(enabled?: boolean): Promise<readonly OperationalAlertRuleRecord[]>;
    upsert(i: OperationalAlertRuleRecord): Promise<OperationalAlertRuleRecord>;
  };
  alert: {
    upsert(i: OperationalAlertRecord): Promise<OperationalAlertRecord>;
    list(
      s?: string,
      v?: string,
      l?: number,
    ): Promise<readonly OperationalAlertRecord[]>;
    resolve(u: string): Promise<OperationalAlertRecord>;
  };
  aggregate(): Promise<{
    featureFlags: number;
    importProfiles: number;
    integrations: Record<IntegrationState, number>;
    openConflicts: number;
    openAlerts: number;
    runningOperations: number;
    pendingEvents: number;
  }>;
}
