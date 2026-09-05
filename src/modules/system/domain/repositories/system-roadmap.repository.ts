import type { IntegrationState } from '../integration/integration.contracts.js';
import type { IntegrationCredentialStatus } from '../integration/integration-operation.contracts.js';

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
  credentialType: string;
  secretRef: string | null;
  accessTokenRef: string | null;
  refreshTokenRef: string | null;
  version: number;
  status: IntegrationCredentialStatus;
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
    list(environment?: string): Promise<readonly FeatureFlagRecord[]>;
    get(key: string, environment: string): Promise<FeatureFlagRecord | null>;
    upsert(
      input: Omit<FeatureFlagRecord, 'createdAt' | 'updatedAt'>,
    ): Promise<FeatureFlagRecord>;
  };
  importProfile: {
    create(
      input: Omit<ImportProfileRecord, 'createdAt' | 'updatedAt'>,
    ): Promise<ImportProfileRecord>;
    list(
      entity?: string,
      active?: boolean,
    ): Promise<readonly ImportProfileRecord[]>;
    get(uuid: string): Promise<ImportProfileRecord | null>;
    update(
      uuid: string,
      input: Partial<
        Omit<ImportProfileRecord, 'uuid' | 'createdAt' | 'updatedAt'>
      >,
    ): Promise<ImportProfileRecord>;
  };
  credential: {
    get(uuid: string): Promise<IntegrationCredentialRecord | null>;
    list(
      integrationId: bigint,
      credentialType?: string,
    ): Promise<readonly IntegrationCredentialRecord[]>;
    create(
      input: Omit<IntegrationCredentialRecord, 'issuedAt' | 'lastUsedAt'> &
        Partial<
          Pick<
            IntegrationCredentialRecord,
            'accessTokenRef' | 'refreshTokenRef'
          >
        >,
    ): Promise<IntegrationCredentialRecord>;
    revoke(
      uuid: string,
      revokedAt: Date,
    ): Promise<IntegrationCredentialRecord>;
    markUsed(
      uuid: string,
      lastUsedAt: Date,
    ): Promise<IntegrationCredentialRecord>;
    rotate(
      uuid: string,
      input: {
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
    getOrCreate(integrationId: bigint): Promise<IntegrationRuntimeRecord>;
    update(
      integrationId: bigint,
      patch: Partial<Omit<IntegrationRuntimeRecord, 'uuid' | 'integrationId'>>,
    ): Promise<IntegrationRuntimeRecord>;
  };
  operation: {
    getByIdempotency(
      integrationId: bigint,
      idempotencyKey: string,
    ): Promise<IntegrationOperationRecord | null>;
    create(
      input: IntegrationOperationRecord,
    ): Promise<IntegrationOperationRecord>;
    update(
      uuid: string,
      input: Partial<Omit<IntegrationOperationRecord, 'uuid'>>,
    ): Promise<IntegrationOperationRecord>;
    list(
      integrationId: bigint,
      state?: string,
      limit?: number,
    ): Promise<readonly IntegrationOperationRecord[]>;
  };
  event: {
    create(input: IntegrationEventRecord): Promise<IntegrationEventRecord>;
    getByKey(
      integrationId: bigint,
      eventKey: string,
    ): Promise<IntegrationEventRecord | null>;
    update(
      uuid: string,
      input: Partial<Omit<IntegrationEventRecord, 'uuid'>>,
    ): Promise<IntegrationEventRecord>;
    list(
      integrationId: bigint,
      status?: string,
      limit?: number,
    ): Promise<readonly IntegrationEventRecord[]>;
  };
  idempotency: {
    reserve(
      input: Omit<IntegrationIdempotencyRecord, 'createdAt' | 'updatedAt'>,
    ): Promise<{ record: IntegrationIdempotencyRecord; created: boolean }>;
    update(
      uuid: string,
      input: Partial<
        Omit<IntegrationIdempotencyRecord, 'uuid' | 'integrationId'>
      >,
    ): Promise<IntegrationIdempotencyRecord>;
  };
  conflict: {
    upsert(
      input: IntegrationConflictRecord,
    ): Promise<IntegrationConflictRecord>;
    get(
      integrationId: bigint,
      conflictKey: string,
    ): Promise<IntegrationConflictRecord | null>;
    list(
      integrationId: bigint,
      status?: string,
      limit?: number,
    ): Promise<readonly IntegrationConflictRecord[]>;
    resolve(
      integrationId: bigint,
      conflictKey: string,
      input: { resolution: string; resolvedBy: string },
    ): Promise<IntegrationConflictRecord>;
  };
  alertRule: {
    list(enabled?: boolean): Promise<readonly OperationalAlertRuleRecord[]>;
    upsert(
      input: OperationalAlertRuleRecord,
    ): Promise<OperationalAlertRuleRecord>;
  };
  alert: {
    upsert(input: OperationalAlertRecord): Promise<OperationalAlertRecord>;
    list(
      status?: string,
      severity?: string,
      limit?: number,
    ): Promise<readonly OperationalAlertRecord[]>;
    resolve(uuid: string): Promise<OperationalAlertRecord>;
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
