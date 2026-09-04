import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import {
  SYSTEM_SETTINGS_REPOSITORY,
  type SystemSettingsRepository,
} from '../../domain/repositories/system-settings.repository.js';
import type { SystemOperationalDiagnostics, SystemOperationalState } from '../../domain/operations/system-operations.contracts.js';
import {
  SYSTEM_JOB_HEALTH_PORT,
  SYSTEM_STORAGE_HEALTH_PORT,
  type SystemJobHealthPort,
  type SystemStorageHealthPort,
} from '../../domain/operations/system-operations.port.js';

const MAINTENANCE_KEY = 'system.maintenance_mode';
const READ_ONLY_KEY = 'system.read_only_mode';

@Injectable()
export class SystemOperationsService {
  constructor(
    @Inject(SYSTEM_SETTINGS_REPOSITORY)
    private readonly settings: SystemSettingsRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
    @Inject(SYSTEM_STORAGE_HEALTH_PORT)
    private readonly storageHealth: SystemStorageHealthPort,
    @Inject(SYSTEM_JOB_HEALTH_PORT)
    private readonly jobHealth: SystemJobHealthPort,
  ) {}

  async state(): Promise<SystemOperationalState> {
    const [maintenance, readOnly] = await Promise.all([
      this.settings.get(MAINTENANCE_KEY, 'global', 'global'),
      this.settings.get(READ_ONLY_KEY, 'global', 'global'),
    ]);
    const updatedAt = [maintenance?.updatedAt, readOnly?.updatedAt]
      .filter(Boolean)
      .sort((a, b) => b!.getTime() - a!.getTime())[0];
    return {
      maintenanceMode: maintenance?.value === 'true',
      readOnlyMode: readOnly?.value === 'true',
      updatedAt: updatedAt?.toISOString() ?? null,
    };
  }

  async setMaintenance(actorUuid: string, enabled: boolean) {
    const current = await this.settings.get(MAINTENANCE_KEY, 'global', 'global');
    await this.settings.upsert({
      key: MAINTENANCE_KEY,
      scope: 'global',
      scopeKey: 'global',
      valueType: 'boolean',
      value: String(enabled),
      mutable: true,
      expectedVersion: current?.version,
    });
    await this.audit.record({
      action: 'SYSTEM_SETTING_UPDATED',
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'system_setting',
      entityUuid: current?.uuid ?? randomUUID(),
      result: 'SUCCESS',
      reason: `maintenanceMode=${enabled}`,
    });
    return this.state();
  }

  async setReadOnly(actorUuid: string, enabled: boolean) {
    const current = await this.settings.get(READ_ONLY_KEY, 'global', 'global');
    await this.settings.upsert({
      key: READ_ONLY_KEY,
      scope: 'global',
      scopeKey: 'global',
      valueType: 'boolean',
      value: String(enabled),
      mutable: true,
      expectedVersion: current?.version,
    });
    await this.audit.record({
      action: 'SYSTEM_SETTING_UPDATED',
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'system_setting',
      entityUuid: current?.uuid ?? randomUUID(),
      result: 'SUCCESS',
      reason: `readOnlyMode=${enabled}`,
    });
    return this.state();
  }

  async diagnostics(): Promise<SystemOperationalDiagnostics> {
    const state = await this.state();
    const [storage, jobs] = await Promise.all([
      this.storageHealth.check(),
      this.jobHealth.check(),
    ]);
    const components = {
      database: 'unknown' as const,
      storage,
      jobs,
    };
    const degraded = storage === 'down' || jobs === 'down';
    return {
      status: degraded ? 'degraded' : 'ok',
      maintenanceMode: state.maintenanceMode,
      readOnlyMode: state.readOnlyMode,
      components,
    };
  }
}
