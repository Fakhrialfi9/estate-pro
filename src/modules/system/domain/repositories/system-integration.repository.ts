import type {
  IntegrationState,
  SystemIntegrationRecord,
} from '../integration/integration.contracts.js';

export const SYSTEM_INTEGRATION_REPOSITORY = Symbol(
  'SYSTEM_INTEGRATION_REPOSITORY',
);

export interface SystemIntegrationRepository {
  create(input: {
    uuid: string;
    providerKey: string;
    providerVersion: string;
    capabilities: readonly string[];
    state: IntegrationState;
    metadata: Record<string, unknown>;
    secretRef?: string | null;
  }): Promise<SystemIntegrationRecord>;
  get(uuid: string): Promise<SystemIntegrationRecord | null>;
  list(input: {
    page: number;
    limit: number;
    state?: IntegrationState;
  }): Promise<{
    items: readonly SystemIntegrationRecord[];
    total: number;
  }>;
  update(
    uuid: string,
    input: Partial<
      Pick<
        SystemIntegrationRecord,
        | 'state'
        | 'metadata'
        | 'secretRef'
        | 'lastTestAt'
        | 'lastSyncAt'
        | 'errorCode'
        | 'errorMessage'
      >
    >,
  ): Promise<SystemIntegrationRecord>;
  delete(uuid: string): Promise<void>;
}
