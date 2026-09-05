import type { IntegrationOperationRecord } from './system-roadmap.repository.js';

export const SYSTEM_INTEGRATION_OPERATION_RETRY_REPOSITORY = Symbol(
  'SYSTEM_INTEGRATION_OPERATION_RETRY_REPOSITORY',
);

export interface SystemIntegrationOperationRetryRepository {
  claimDue(
    integrationId: bigint,
    now: Date,
    limit?: number,
  ): Promise<readonly IntegrationOperationRecord[]>;
}
