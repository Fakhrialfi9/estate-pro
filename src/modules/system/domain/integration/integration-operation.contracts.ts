export type IntegrationSyncDirection = 'PULL' | 'PUSH' | 'BIDIRECTIONAL';

export type IntegrationCredentialType =
  | 'API_KEY'
  | 'OAUTH2'
  | 'BEARER'
  | 'BASIC';

export type IntegrationCredentialStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'REVOKED'
  | 'ROTATED';

export type IntegrationOperationState =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'RETRY_SCHEDULED'
  | 'CANCELLED';

export type IntegrationRetryMetadata = Readonly<{
  attempt: number;
  maxAttempts: number;
  nextAttemptAt: Date | null;
  retryable: boolean;
  errorCode: string | null;
}>;

export type IntegrationCredential = Readonly<{
  uuid: string;
  credentialType: IntegrationCredentialType;
  status: IntegrationCredentialStatus;
  version: number;
  secretRef: string;
  issuedAt: Date;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type CanonicalIntegrationRequest = Readonly<{
  operationKey: string;
  direction: IntegrationSyncDirection;
  resourceType: string;
  resourceUuid?: string;
  payload: Readonly<Record<string, unknown>>;
  idempotencyKey: string;
  occurredAt: Date;
}>;

export type CanonicalIntegrationResponse = Readonly<{
  ok: boolean;
  operationKey: string;
  resourceType?: string;
  resourceUuid?: string;
  data: Readonly<Record<string, unknown>>;
  errorCode: string | null;
  errorMessage: string | null;
  providerRequestId: string | null;
  receivedAt: Date;
}>;

export type IntegrationEvent = Readonly<{
  eventKey: string;
  eventName: string;
  eventVersion: number;
  aggregateType: string;
  aggregateUuid: string;
  occurredAt: Date;
  payload: Readonly<Record<string, unknown>>;
}>;

export interface IntegrationProviderCredentialPort {
  refreshAccessToken?(input: {
    clientReference: string;
    refreshTokenReference: string;
    scopes: readonly string[];
  }): Promise<{
    accessTokenReference: string;
    refreshTokenReference?: string;
    accessTokenExpiresAt: Date;
    refreshTokenExpiresAt?: Date;
  }>;
}

export interface IntegrationProviderOperationPort {
  push?(
    request: CanonicalIntegrationRequest,
  ): Promise<CanonicalIntegrationResponse>;
  pull?(input: {
    resourceType: string;
    cursor?: string | null;
    limit: number;
  }): Promise<{
    records: readonly Readonly<Record<string, unknown>>[];
    nextCursor: string | null;
  }>;
  mapRequest?(request: CanonicalIntegrationRequest): unknown;
  mapResponse?(response: unknown): CanonicalIntegrationResponse;
}

export interface IntegrationProviderInboundPort {
  verifySignature?(input: {
    timestamp: string;
    body: string;
    signature: string;
    keyVersion?: string;
    secretRef?: string | null;
  }): boolean | Promise<boolean>;
  normalizeInbound?(input: unknown): Readonly<{
    eventKey: string;
    eventName: string;
    eventVersion: number;
    aggregateType: string;
    aggregateUuid: string;
    occurredAt: Date;
    payload: Readonly<Record<string, unknown>>;
  }>;
}

export interface IntegrationProviderHealthPort {
  health?(): Promise<{
    ok: boolean;
    latencyMs: number;
    code?: string;
  }>;
}
