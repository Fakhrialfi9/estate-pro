import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import type {
  IntegrationProviderPort,
  IntegrationState,
  SystemIntegrationRecord,
} from '../../domain/integration/integration.contracts.js';
import {
  SYSTEM_INTEGRATION_REPOSITORY,
  type SystemIntegrationRepository,
} from '../../domain/repositories/system-integration.repository.js';

const MAX_PAGE_SIZE = 100;

@Injectable()
export class SystemIntegrationService {
  private readonly providers = new Map<string, IntegrationProviderPort>();

  constructor(
    @Inject(SYSTEM_INTEGRATION_REPOSITORY)
    private readonly repository: SystemIntegrationRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  registerProvider(provider: IntegrationProviderPort): void {
    if (!provider.key || !provider.version)
      throw new Error('Integration provider identity is required');
    this.providers.set(
      this.providerId(provider.key, provider.version),
      provider,
    );
  }

  registry() {
    return [...this.providers.values()].map((provider) => ({
      key: provider.key,
      version: provider.version,
      capabilities: [...provider.capabilities],
    }));
  }

  async create(
    actorUuid: string,
    input: {
      providerKey: string;
      providerVersion: string;
      metadata: Record<string, unknown>;
      secretRef?: string;
    },
  ) {
    const provider = this.findProvider(
      input.providerKey,
      input.providerVersion,
    );
    const existing = await this.findByProvider(
      input.providerKey,
      input.providerVersion,
    );
    if (existing) return this.toPublic(existing);
    const row = await this.repository.create({
      uuid: randomUUID(),
      providerKey: provider.key,
      providerVersion: provider.version,
      capabilities: provider.capabilities,
      state: 'CONFIGURED',
      metadata: this.safeMetadata(input.metadata),
      secretRef: input.secretRef ?? null,
    });
    await this.audit.record({
      action: 'SYSTEM_SETTING_UPDATED',
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'system_integration',
      entityUuid: row.uuid,
      result: 'SUCCESS',
      reason: `integration.connected=${provider.key}@${provider.version}`,
    });
    return this.toPublic(row);
  }

  async list(page = 1, limit = 20, state?: IntegrationState) {
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.min(MAX_PAGE_SIZE, Math.max(1, limit));
    const result = await this.repository.list({
      page: normalizedPage,
      limit: normalizedLimit,
      state,
    });
    return {
      items: result.items.map((row) => this.toPublic(row)),
      total: result.total,
      page: normalizedPage,
      limit: normalizedLimit,
    };
  }

  async get(uuid: string) {
    const row = await this.repository.get(uuid);
    if (!row) throw new NotFoundException('Integration not found');
    return this.toPublic(row);
  }

  async update(
    actorUuid: string,
    uuid: string,
    input: {
      metadata?: Record<string, unknown>;
      secretRef?: string | null;
      enabled?: boolean;
    },
  ) {
    const current = await this.require(uuid);
    const row = await this.repository.update(uuid, {
      ...(input.metadata
        ? { metadata: this.safeMetadata(input.metadata) }
        : {}),
      ...(input.secretRef !== undefined ? { secretRef: input.secretRef } : {}),
      ...(input.enabled !== undefined
        ? { state: input.enabled ? 'ACTIVE' : 'DISABLED' }
        : {}),
    });
    await this.audit.record({
      action: 'SYSTEM_SETTING_UPDATED',
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'system_integration',
      entityUuid: current.uuid,
      result: 'SUCCESS',
      reason: 'integration.updated',
    });
    return this.toPublic(row);
  }

  async remove(actorUuid: string, uuid: string) {
    await this.require(uuid);
    await this.repository.delete(uuid);
    await this.audit.record({
      action: 'SYSTEM_SETTING_UPDATED',
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'system_integration',
      entityUuid: uuid,
      result: 'SUCCESS',
      reason: 'integration.disconnected',
    });
  }

  async test(actorUuid: string, uuid: string) {
    const row = await this.require(uuid);
    const provider = this.findProvider(row.providerKey, row.providerVersion);
    const started = performance.now();
    const result = await provider.testConnection({
      metadata: row.metadata,
      secretRef: row.secretRef,
    });
    const latencyMs =
      result.latencyMs ?? Math.round(performance.now() - started);
    const updated = await this.repository.update(uuid, {
      lastTestAt: new Date(),
      state: result.ok ? 'ACTIVE' : 'ERROR',
      errorCode: result.ok ? null : (result.code ?? 'CONNECTION_TEST_FAILED'),
      errorMessage: result.ok
        ? null
        : (result.message ?? 'Connection test failed'),
    });
    await this.audit.record({
      action: 'SYSTEM_SETTING_UPDATED',
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'system_integration',
      entityUuid: uuid,
      result: result.ok ? 'SUCCESS' : 'FAILURE',
      reason: `integration.test.latencyMs=${latencyMs}`,
    });
    return {
      uuid: updated.uuid,
      ok: result.ok,
      latencyMs,
      code: result.code ?? null,
      message: result.ok ? null : (result.message ?? 'Connection test failed'),
    };
  }

  async sync(actorUuid: string, uuid: string) {
    const row = await this.require(uuid);
    const provider = this.findProvider(row.providerKey, row.providerVersion);
    if (!provider.sync)
      throw new NotFoundException(
        'Integration sync capability is not implemented for this provider',
      );
    const result = await provider.sync({
      metadata: row.metadata,
      secretRef: row.secretRef,
    });
    const updated = await this.repository.update(uuid, {
      lastSyncAt: new Date(),
      state: result.state === 'SUCCEEDED' ? 'ACTIVE' : 'ERROR',
      errorCode:
        result.state === 'SUCCEEDED' ? null : (result.code ?? 'SYNC_FAILED'),
      errorMessage:
        result.state === 'SUCCEEDED'
          ? null
          : (result.message ?? 'Integration sync failed'),
    });
    await this.audit.record({
      action: 'SYSTEM_SETTING_UPDATED',
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'system_integration',
      entityUuid: uuid,
      result: result.state === 'SUCCEEDED' ? 'SUCCESS' : 'FAILURE',
      reason: `integration.sync.recordsRead=${result.recordsRead ?? 0};recordsChanged=${result.recordsChanged ?? 0}`,
    });
    return {
      uuid: updated.uuid,
      state: result.state,
      recordsRead: result.recordsRead ?? 0,
      recordsChanged: result.recordsChanged ?? 0,
      code: result.code ?? null,
      message: result.message ?? null,
    };
  }

  async reconciliation(uuid: string) {
    const row = await this.require(uuid);
    return {
      uuid: row.uuid,
      providerKey: row.providerKey,
      state: row.state,
      status: 'READ_ONLY_RECONCILIATION_NOT_CONFIGURED',
      conflicts: [],
      destructiveChanges: false,
    };
  }

  private async require(uuid: string) {
    const row = await this.repository.get(uuid);
    if (!row) throw new NotFoundException('Integration not found');
    return row;
  }

  private findProvider(key: string, version: string) {
    const provider = this.providers.get(this.providerId(key, version));
    if (!provider)
      throw new NotFoundException('Integration provider is not registered');
    return provider;
  }

  private async findByProvider(
    key: string,
    version: string,
  ): Promise<SystemIntegrationRecord | null> {
    const result = await this.repository.list({ page: 1, limit: 100 });
    return (
      result.items.find(
        (row) => row.providerKey === key && row.providerVersion === version,
      ) ?? null
    );
  }

  private providerId(key: string, version: string) {
    return `${key}:${version}`;
  }

  private safeMetadata(input: Record<string, unknown>) {
    const sanitized = { ...input };
    for (const key of Object.keys(sanitized)) {
      if (/secret|token|password|authorization|cookie/i.test(key))
        delete sanitized[key];
    }
    return sanitized;
  }

  private toPublic(row: SystemIntegrationRecord) {
    return {
      uuid: row.uuid,
      providerKey: row.providerKey,
      providerVersion: row.providerVersion,
      capabilities: row.capabilities,
      state: row.state,
      metadata: row.metadata,
      secretConfigured: Boolean(row.secretRef),
      lastTestAt: row.lastTestAt,
      lastSyncAt: row.lastSyncAt,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
