import { createHash } from 'node:crypto';

import type { SeedTransaction } from '../database.ts';
import { seedUuid, SEED_REFERENCE_DATE } from '../shared/ids.ts';
import { ALERT_RULES, FEATURE_FLAGS, IMPORT_PROFILES, INTEGRATIONS, SYSTEM_SETTINGS } from './data.ts';

const ADMIN_UUID = '00000000-0000-5000-8000-000000000001';

function hashPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export async function seedSystem(tx: SeedTransaction): Promise<void> {
  for (const [key, scope, scopeKey, valueType, value] of SYSTEM_SETTINGS) {
    await tx.systemSetting.upsert({
      where: { key_scope_scopeKey: { key, scope, scopeKey } },
      update: { valueType, value, mutable: true, version: 1 },
      create: { uuid: seedUuid('system-setting', `${scope}:${scopeKey}:${key}`), key, scope, scopeKey, valueType, value, mutable: true, version: 1 },
    });
  }

  for (const [key, environment, enabled, rolloutPercentage] of FEATURE_FLAGS) {
    await tx.systemFeatureFlag.upsert({
      where: { key_environment: { key, environment } },
      update: { enabled, rolloutPercentage, description: `Seed feature flag: ${key}`, metadata: { source: 'seed' }, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID },
      create: { uuid: seedUuid('system-feature-flag', `${environment}:${key}`), key, environment, enabled, rolloutPercentage, description: `Seed feature flag: ${key}`, metadata: { source: 'seed' }, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID },
    });
  }

  for (const profile of IMPORT_PROFILES) {
    await tx.systemImportProfile.upsert({
      where: { name_version: { name: profile.name, version: 1 } },
      update: { entity: profile.entity, format: profile.format, columnMapping: profile.columnMapping, fieldMapping: profile.fieldMapping, conflictStrategy: profile.conflictStrategy, transactionStrategy: profile.transactionStrategy, active: true, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID },
      create: { uuid: seedUuid('system-import-profile', profile.name), name: profile.name, entity: profile.entity, version: 1, format: profile.format, columnMapping: profile.columnMapping, fieldMapping: profile.fieldMapping, conflictStrategy: profile.conflictStrategy, transactionStrategy: profile.transactionStrategy, active: true, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID },
    });
  }

  for (const integration of INTEGRATIONS) {
    const record = await tx.systemIntegration.upsert({
      where: { providerKey_providerVersion: { providerKey: integration.providerKey, providerVersion: integration.providerVersion } },
      update: { state: integration.state, capabilities: integration.capabilities, metadata: integration.metadata, secretRef: 'env:ESTATEPRO_SEED_INTEGRATION_SECRET', errorCode: null, errorMessage: null },
      create: { uuid: seedUuid('system-integration', integration.providerKey), providerKey: integration.providerKey, providerVersion: integration.providerVersion, state: integration.state, capabilities: integration.capabilities, metadata: integration.metadata, secretRef: 'env:ESTATEPRO_SEED_INTEGRATION_SECRET' },
    });
    await tx.systemIntegrationRuntime.upsert({
      where: { integrationId: record.id },
      update: { circuitState: 'CLOSED', failureCount: 0, successCount: 1, syncDirection: 'BIDIRECTIONAL', requestMapping: {}, responseMapping: {}, metadata: { source: 'seed' }, lastHealthAt: SEED_REFERENCE_DATE, lastOperationStatus: 'SUCCEEDED' },
      create: { uuid: seedUuid('system-integration-runtime', integration.providerKey), integrationId: record.id, circuitState: 'CLOSED', failureCount: 0, successCount: 1, syncDirection: 'BIDIRECTIONAL', requestMapping: {}, responseMapping: {}, metadata: { source: 'seed' }, lastHealthAt: SEED_REFERENCE_DATE, lastOperationStatus: 'SUCCEEDED' },
    });
    const payload = { source: 'seed', event: 'property.listing.published', version: 1 };
    const payloadHash = hashPayload(payload);
    await tx.systemIntegrationEvent.upsert({
      where: { integrationId_eventKey: { integrationId: record.id, eventKey: 'seed-property-listing-001' } },
      update: { eventName: 'property.listing.published', eventVersion: 1, payload, payloadHash, status: 'PROCESSED', occurredAt: SEED_REFERENCE_DATE, processedAt: SEED_REFERENCE_DATE },
      create: { uuid: seedUuid('system-integration-event', `${integration.providerKey}:seed-property-listing-001`), integrationId: record.id, eventKey: 'seed-property-listing-001', eventName: 'property.listing.published', eventVersion: 1, payload, payloadHash, status: 'PROCESSED', occurredAt: SEED_REFERENCE_DATE, processedAt: SEED_REFERENCE_DATE },
    });
    await tx.systemIntegrationIdempotency.upsert({
      where: { integrationId_eventKey_eventName_eventVersion: { integrationId: record.id, eventKey: 'seed-property-listing-001', eventName: 'property.listing.published', eventVersion: 1 } },
      update: { payloadHash, status: 'PROCESSED', attempt: 1, processedAt: SEED_REFERENCE_DATE, lastErrorCode: null },
      create: { uuid: seedUuid('system-integration-idempotency', `${integration.providerKey}:seed-property-listing-001`), integrationId: record.id, eventKey: 'seed-property-listing-001', eventName: 'property.listing.published', eventVersion: 1, payloadHash, status: 'PROCESSED', attempt: 1, processedAt: SEED_REFERENCE_DATE },
    });
    await tx.systemIntegrationOperation.upsert({
      where: { integrationId_idempotencyKey: { integrationId: record.id, idempotencyKey: 'seed-integration-operation-001' } },
      update: { operationKey: 'property.listing.publish', direction: 'OUTBOUND', attempt: 1, maxAttempts: 3, state: 'SUCCEEDED', requestHash: payloadHash, responseHash: payloadHash, requestPayload: payload, responsePayload: { accepted: true }, completedAt: SEED_REFERENCE_DATE, metadata: { source: 'seed' } },
      create: { uuid: seedUuid('system-integration-operation', `${integration.providerKey}:seed-integration-operation-001`), integrationId: record.id, operationKey: 'property.listing.publish', direction: 'OUTBOUND', idempotencyKey: 'seed-integration-operation-001', attempt: 1, maxAttempts: 3, state: 'SUCCEEDED', requestHash: payloadHash, responseHash: payloadHash, requestPayload: payload, responsePayload: { accepted: true }, completedAt: SEED_REFERENCE_DATE, metadata: { source: 'seed' } },
    });
  }

  for (const [ruleKey, signal, severity, threshold, windowSeconds, cooldownSeconds] of ALERT_RULES) {
    await tx.systemOperationalAlertRule.upsert({
      where: { ruleKey },
      update: { signal, severity, threshold, windowSeconds, cooldownSeconds, enabled: true, metadata: { source: 'seed' } },
      create: { uuid: seedUuid('system-alert-rule', ruleKey), ruleKey, signal, severity, threshold, windowSeconds, cooldownSeconds, enabled: true, metadata: { source: 'seed' } },
    });
  }

  await tx.systemActivity.createMany({
    data: [{
      uuid: seedUuid('system-activity', 'bootstrap'),
      actorUuid: ADMIN_UUID,
      eventType: 'SEED_BOOTSTRAP',
      category: 'SYSTEM',
      resourceType: 'SYSTEM',
      resourceUuid: seedUuid('system', 'estate-pro'),
      summary: 'Estate Pro development seed bootstrap completed.',
      metadata: { source: 'prisma-seed', referenceDate: SEED_REFERENCE_DATE.toISOString() },
      createdAt: SEED_REFERENCE_DATE,
    }],
    skipDuplicates: true,
  });
}
