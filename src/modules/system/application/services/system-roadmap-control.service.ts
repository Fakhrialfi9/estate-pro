import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import type { SystemIntegrationRepository } from '../../domain/repositories/system-integration.repository.js';
import { SYSTEM_INTEGRATION_REPOSITORY } from '../../domain/repositories/system-integration.repository.js';
import type { SystemRoadmapRepository } from '../../domain/repositories/system-roadmap.repository.js';
import { SYSTEM_ROADMAP_REPOSITORY } from '../../domain/repositories/system-roadmap.repository.js';

@Injectable()
export class SystemRoadmapControlService {
  constructor(
    @Inject(SYSTEM_ROADMAP_REPOSITORY) private readonly roadmap: SystemRoadmapRepository,
    @Inject(SYSTEM_INTEGRATION_REPOSITORY) private readonly integrations: SystemIntegrationRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY) private readonly audit: SecurityAuditRepository,
    private readonly config: ConfigService,
  ) {}

  async dashboard() {
    const [aggregate, integrations] = await Promise.all([
      this.roadmap.aggregate(),
      this.integrations.list({ page: 1, limit: 100 }),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      environment: this.environment(),
      ...aggregate,
      integrationHealth: integrations.items.map((row) => ({
        uuid: row.uuid, providerKey: row.providerKey, state: row.state,
        lastTestAt: row.lastTestAt, lastSyncAt: row.lastSyncAt, errorCode: row.errorCode,
      })),
    };
  }

  environment() {
    const safe: Record<string, string> = {};
    for (const key of ['NODE_ENV', 'APP_ENV', 'APP_VERSION', 'BUILD_SHA', 'REGION', 'LOG_LEVEL']) {
      const value = process.env[key];
      if (value !== undefined) safe[key] = value;
    }
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptimeSeconds: Math.floor(process.uptime()),
      environment: this.config.get<string>('app.environment', 'development'),
      version: this.config.get<string>('app.version', safe.APP_VERSION ?? '0.0.0'),
      buildSha: safe.BUILD_SHA ?? null,
      region: safe.REGION ?? null,
      safeVariables: safe,
    };
  }

  listFlags(environment?: string) { return this.roadmap.featureFlag.list(environment); }

  async setFlag(actorUuid: string, input: { key: string; environment: string; enabled: boolean; rolloutPercentage?: number; description?: string; metadata?: Record<string, unknown> }) {
    if (!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(input.environment)) throw new Error('Invalid environment identifier');
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(input.key)) throw new Error('Invalid feature flag key');
    const row = await this.roadmap.featureFlag.upsert({
      uuid: randomUUID(), key: input.key, environment: input.environment,
      enabled: input.enabled, rolloutPercentage: clamp(input.rolloutPercentage ?? 100, 0, 100),
      description: input.description?.trim() || null, metadata: sanitize(input.metadata ?? {}),
      createdBy: actorUuid, updatedBy: actorUuid,
    });
    await this.auditRecord(actorUuid, row.uuid, `feature-flag:${row.key}`);
    return row;
  }

  async evaluateFlag(key: string, environment: string, subjectKey?: string) {
    const flag = await this.roadmap.featureFlag.get(key, environment);
    if (!flag?.enabled || flag.rolloutPercentage <= 0) return false;
    if (flag.rolloutPercentage >= 100) return true;
    if (!subjectKey) return false;
    const bucket = Number.parseInt(createHash('sha256').update(`${key}:${environment}:${subjectKey}`).digest('hex').slice(0, 8), 16) % 100;
    return bucket < flag.rolloutPercentage;
  }

  async createImportProfile(actorUuid: string, input: { name: string; entity: string; version?: number; format: string; columnMapping: Record<string, unknown>; fieldMapping: Record<string, unknown>; conflictStrategy: string; transactionStrategy: string; active?: boolean }) {
    validateMapping(input.columnMapping); validateMapping(input.fieldMapping);
    const row = await this.roadmap.importProfile.create({
      uuid: randomUUID(), name: input.name.trim(), entity: input.entity.trim(), version: Math.max(1, input.version ?? 1),
      format: input.format, columnMapping: sanitize(input.columnMapping), fieldMapping: sanitize(input.fieldMapping),
      conflictStrategy: input.conflictStrategy, transactionStrategy: input.transactionStrategy, active: input.active === true,
      createdBy: actorUuid, updatedBy: actorUuid,
    });
    await this.auditRecord(actorUuid, row.uuid, 'import-profile-created');
    return row;
  }

  listImportProfiles(entity?: string, active?: boolean) { return this.roadmap.importProfile.list(entity, active); }

  async getImportProfile(uuid: string) {
    const row = await this.roadmap.importProfile.get(uuid);
    if (!row) throw new NotFoundException('Import profile not found');
    return row;
  }

  async updateImportProfile(actorUuid: string, uuid: string, input: Record<string, unknown>) {
    if (input.columnMapping) validateMapping(asObject(input.columnMapping));
    if (input.fieldMapping) validateMapping(asObject(input.fieldMapping));
    const row = await this.roadmap.importProfile.update(uuid, {
      ...(input.name !== undefined ? { name: String(input.name).trim() } : {}),
      ...(input.entity !== undefined ? { entity: String(input.entity).trim() } : {}),
      ...(input.version !== undefined ? { version: Number(input.version) } : {}),
      ...(input.format !== undefined ? { format: String(input.format) } : {}),
      ...(input.columnMapping ? { columnMapping: sanitize(asObject(input.columnMapping)) } : {}),
      ...(input.fieldMapping ? { fieldMapping: sanitize(asObject(input.fieldMapping)) } : {}),
      ...(input.conflictStrategy !== undefined ? { conflictStrategy: String(input.conflictStrategy) } : {}),
      ...(input.transactionStrategy !== undefined ? { transactionStrategy: String(input.transactionStrategy) } : {}),
      ...(input.active !== undefined ? { active: Boolean(input.active) } : {}),
      updatedBy: actorUuid,
    });
    await this.auditRecord(actorUuid, row.uuid, 'import-profile-updated');
    return row;
  }

  private async integration(uuid: string) {
    const row = await this.integrations.get(uuid);
    if (!row) throw new NotFoundException('Integration not found');
    return row;
  }

  async credentials(uuid: string, credentialType?: string) {
    const integration = await this.integration(uuid);
    return (await this.roadmap.credential.list(integration.id, credentialType)).map((row) => ({ ...row, secretRef: redact(row.secretRef) }));
  }

  async createCredential(actorUuid: string, uuid: string, input: { credentialType: string; secretRef: string; accessTokenExpiresAt?: Date|null; refreshTokenExpiresAt?: Date|null; metadata?: Record<string, unknown> }) {
    const integration = await this.integration(uuid); assertVaultRef(input.secretRef);
    const current = await this.roadmap.credential.list(integration.id, input.credentialType);
    const row = await this.roadmap.credential.create({ uuid: randomUUID(), integrationId: integration.id, credentialType: input.credentialType, secretRef: input.secretRef, version: (current[0]?.version ?? 0) + 1, status: 'ACTIVE', accessTokenExpiresAt: input.accessTokenExpiresAt ?? null, refreshTokenExpiresAt: input.refreshTokenExpiresAt ?? null, rotatedAt: null, revokedAt: null, metadata: sanitize(input.metadata ?? {}) });
    await this.auditRecord(actorUuid, row.uuid, 'credential-created');
    return { ...row, secretRef: redact(row.secretRef) };
  }

  async rotateCredential(actorUuid: string, credentialUuid: string, input: { secretRef: string; accessTokenExpiresAt?: Date|null; refreshTokenExpiresAt?: Date|null; metadata?: Record<string, unknown> }) {
    assertVaultRef(input.secretRef);
    const row = await this.roadmap.credential.rotate(credentialUuid, input);
    await this.auditRecord(actorUuid, row.uuid, 'credential-rotated');
    return { ...row, secretRef: redact(row.secretRef) };
  }

  async revokeCredential(actorUuid: string, credentialUuid: string) {
    const row = await this.roadmap.credential.revoke(credentialUuid, new Date());
    await this.auditRecord(actorUuid, row.uuid, 'credential-revoked');
    return { ...row, secretRef: redact(row.secretRef) };
  }

  async runtime(uuid: string) { const integration = await this.integration(uuid); return this.roadmap.runtime.getOrCreate(integration.id); }

  async configureRuntime(actorUuid: string, uuid: string, input: { syncDirection?: string; requestMapping?: Record<string, unknown>; responseMapping?: Record<string, unknown>; metadata?: Record<string, unknown> }) {
    const integration = await this.integration(uuid);
    const current = await this.roadmap.runtime.getOrCreate(integration.id);
    return this.roadmap.runtime.update(integration.id, {
      syncDirection: input.syncDirection ?? current.syncDirection,
      requestMapping: input.requestMapping ? sanitize(input.requestMapping) : current.requestMapping,
      responseMapping: input.responseMapping ? sanitize(input.responseMapping) : current.responseMapping,
      metadata: input.metadata ? sanitize(input.metadata) : current.metadata,
    });
  }

  async operation(actorUuid: string, uuid: string, input: { operationKey: string; direction: string; idempotencyKey: string; requestPayload?: Record<string, unknown>; maxAttempts?: number }) {
    const integration = await this.integration(uuid);
    const runtime = await this.roadmap.runtime.getOrCreate(integration.id);
    const now = new Date();
    if (runtime.circuitState === 'OPEN' && runtime.nextRetryAt && runtime.nextRetryAt > now) throw new Error('Integration circuit breaker is open');
    if (runtime.circuitState === 'OPEN') await this.roadmap.runtime.update(integration.id, { circuitState: 'HALF_OPEN', halfOpenAt: now });
    const existing = await this.roadmap.operation.getByIdempotency(integration.id, input.idempotencyKey);
    if (existing) return existing;
    const row = await this.roadmap.operation.create({ uuid: randomUUID(), integrationId: integration.id, operationKey: input.operationKey, direction: input.direction, idempotencyKey: input.idempotencyKey, attempt: 0, maxAttempts: clamp(input.maxAttempts ?? 3, 1, 10), state: 'RUNNING', requestHash: hashJson(input.requestPayload ?? {}), responseHash: null, requestPayload: sanitize(input.requestPayload ?? {}), responsePayload: null, nextAttemptAt: null, startedAt: now, completedAt: null, errorCode: null, errorMessage: null, metadata: {} });
    await this.auditRecord(actorUuid, row.uuid, 'operation-started');
    return row;
  }

  listOperations(uuid: string, state?: string, limit = 50) { return this.integration(uuid).then((row) => this.roadmap.operation.list(row.id, state, limit)); }

  async completeOperation(actorUuid: string, operationUuid: string, payload: Record<string, unknown> = {}) {
    const row = await this.roadmap.operation.update(operationUuid, { state: 'SUCCEEDED', responseHash: hashJson(payload), responsePayload: sanitize(payload), completedAt: new Date(), errorCode: null, errorMessage: null });
    await this.roadmap.runtime.update(row.integrationId, { circuitState: 'CLOSED', failureCount: 0, successCount: 1, openedAt: null, halfOpenAt: null, nextRetryAt: null, lastOperationAt: new Date(), lastOperationStatus: 'SUCCEEDED' });
    return row;
  }

  async failOperation(actorUuid: string, operationUuid: string, input: { code?: string; message: string; retryable?: boolean }) {
    const row = await this.roadmap.operation.update(operationUuid, { state: input.retryable === false ? 'FAILED' : 'RETRY_SCHEDULED', nextAttemptAt: input.retryable === false ? null : retryAt(1), errorCode: input.code ?? 'INTEGRATION_OPERATION_FAILED', errorMessage: input.message.slice(0, 500) });
    const current = await this.roadmap.runtime.getOrCreate(row.integrationId); const failures = current.failureCount + 1; const open = failures >= 5;
    const runtime = await this.roadmap.runtime.update(row.integrationId, { failureCount: failures, circuitState: open ? 'OPEN' : current.circuitState, openedAt: open ? new Date() : current.openedAt, nextRetryAt: open ? new Date(Date.now()+30000) : retryAt(failures), lastOperationAt: new Date(), lastOperationStatus: 'FAILED' });
    if (open) await this.roadmap.alert.upsert({ uuid: randomUUID(), alertKey: 'integration.circuit.open', severity: 'CRITICAL', status: 'OPEN', message: `Integration circuit opened after ${failures} failures`, dedupeKey: `integration.circuit.open:${row.integrationId}`, resourceType: 'system_integration', resourceUuid: null, metadata: {}, firstSeenAt: new Date(), lastSeenAt: new Date(), resolvedAt: null });
    return { operation: row, runtime };
  }

  async emitEvent(actorUuid: string, uuid: string, input: { eventKey: string; eventName: string; eventVersion?: number; payload: Record<string, unknown>; idempotencyKey?: string }) {
    const integration = await this.integration(uuid); const existing = await this.roadmap.event.getByKey(integration.id, input.eventKey); if (existing) return existing;
    const payload = sanitize(input.payload); return this.roadmap.event.create({ uuid: randomUUID(), integrationId: integration.id, eventKey: input.eventKey, eventName: input.eventName, eventVersion: input.eventVersion ?? 1, payload, payloadHash: hashJson(payload), idempotencyKey: input.idempotencyKey ?? null, status: 'PENDING', occurredAt: new Date(), processedAt: null });
  }
  listEvents(uuid: string, status?: string, limit = 50) { return this.integration(uuid).then((row) => this.roadmap.event.list(row.id, status, limit)); }
  async processEvent(actorUuid: string, eventUuid: string) { return this.roadmap.event.update(eventUuid, { status: 'PROCESSED', processedAt: new Date() }); }
  async recordConflict(actorUuid: string, uuid: string, input: { conflictKey: string; entityType: string; localVersion?: string; remoteVersion?: string; localPayload?: Record<string, unknown>; remotePayload?: Record<string, unknown>; operationUuid?: string }) { const integration = await this.integration(uuid); return this.roadmap.conflict.upsert({ uuid: randomUUID(), integrationId: integration.id, operationUuid: input.operationUuid ?? null, conflictKey: input.conflictKey, entityType: input.entityType, localVersion: input.localVersion ?? null, remoteVersion: input.remoteVersion ?? null, resolution: 'MANUAL', status: 'OPEN', localPayload: sanitize(input.localPayload ?? {}), remotePayload: sanitize(input.remotePayload ?? {}), resolvedBy: null, resolvedAt: null }); }
  conflicts(uuid: string, status?: string, limit = 50) { return this.integration(uuid).then((row) => this.roadmap.conflict.list(row.id, status, limit)); }
  async resolveConflict(actorUuid: string, uuid: string, conflictKey: string, resolution: string) { const integration = await this.integration(uuid); return this.roadmap.conflict.resolve(integration.id, conflictKey, { resolution, resolvedBy: actorUuid }); }
  alerts(status?: string, severity?: string, limit = 50) { return this.roadmap.alert.list(status, severity, limit); }
  resolveAlert(actorUuid: string, uuid: string) { return this.roadmap.alert.resolve(uuid); }
  resync(actorUuid: string, uuid: string, direction: string, entityType?: string) { return this.operation(actorUuid, uuid, { operationKey: `manual-resync:${entityType ?? 'all'}`, direction, idempotencyKey: `manual:${uuid}:${actorUuid}:${Date.now()}`, requestPayload: { entityType: entityType ?? null, manual: true }, maxAttempts: 5 }); }

  private async auditRecord(actorUuid: string, entityUuid: string, reason: string) { await this.audit.record({ action: 'SYSTEM_SETTING_UPDATED', actorUuid, entityType: 'system', entityUuid, result: 'SUCCESS', reason }); }
}

function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, Math.trunc(v))); }
function hashJson(v: Record<string, unknown>) { return createHash('sha256').update(JSON.stringify(v)).digest('hex'); }
function retryAt(attempt: number) { return new Date(Date.now() + Math.min(300, 2 ** Math.max(0, attempt - 1)) * 1000); }
function sanitize(input: Record<string, unknown>) { const output: Record<string, unknown> = {}; for (const [key, value] of Object.entries(input)) if (!['__proto__','constructor','prototype'].includes(key)) output[key] = value; return output; }
function asObject(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function validateMapping(input: Record<string, unknown>) { for (const key of Object.keys(input)) if (!/^[A-Za-z0-9_.-]{1,160}$/.test(key)) throw new Error('Invalid import mapping'); }
function assertVaultRef(value: string) { if (!/^vault:[A-Za-z0-9._/-]{1,240}$/.test(value)) throw new Error('Credential secretRef must reference a configured vault secret'); }
function redact(value: string) { return `vault-ref:${createHash('sha256').update(value).digest('hex').slice(0,12)}`; }
