import type {
  IntegrationProviderCredentialPort,
  IntegrationProviderHealthPort,
  IntegrationProviderInboundPort,
  IntegrationProviderOperationPort,
} from './integration-operation.contracts.js';

export type IntegrationState =
  | 'CONFIGURED'
  | 'ACTIVE'
  | 'DISABLED'
  | 'ERROR'
  | 'DISCONNECTED';

export interface SystemIntegrationRecord {
  id: bigint;
  uuid: string;
  providerKey: string;
  providerVersion: string;
  capabilities: readonly string[];
  state: IntegrationState;
  metadata: Record<string, unknown>;
  secretRef: string | null;
  lastTestAt: Date | null;
  lastSyncAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationProviderPort
  extends IntegrationProviderCredentialPort,
    IntegrationProviderOperationPort,
    IntegrationProviderInboundPort,
    IntegrationProviderHealthPort {
  readonly key: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  testConnection(input: {
    metadata: Record<string, unknown>;
    secretRef?: string | null;
  }): Promise<{
    ok: boolean;
    latencyMs?: number;
    code?: string;
    message?: string;
  }>;
  reconnect?(input: {
    metadata: Record<string, unknown>;
    secretRef?: string | null;
  }): Promise<{
    ok: boolean;
    code?: string;
    message?: string;
  }>;
  disconnect(input: {
    metadata: Record<string, unknown>;
    secretRef?: string | null;
  }): Promise<void>;
  sync?(input: {
    metadata: Record<string, unknown>;
    secretRef?: string | null;
  }): Promise<{
    state: 'SUCCEEDED' | 'FAILED';
    recordsRead?: number;
    recordsChanged?: number;
    code?: string;
    message?: string;
  }>;
}
