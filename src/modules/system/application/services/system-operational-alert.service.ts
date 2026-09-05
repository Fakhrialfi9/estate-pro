import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AUTOMATION_NOTIFICATION_PORT,
  type AutomationNotificationPort,
} from '../../../../common/contracts/automation-system.port.js';
import {
  SECURITY_AUDIT_REPOSITORY,
  type SecurityAuditRepository,
} from '../../../../common/audit/security-audit.port.js';
import {
  SYSTEM_ROADMAP_REPOSITORY,
  type SystemRoadmapRepository,
  type OperationalAlertRecord,
} from '../../domain/repositories/system-roadmap.repository.js';

@Injectable()
export class SystemOperationalAlertService {
  constructor(
    @Inject(SYSTEM_ROADMAP_REPOSITORY)
    private readonly roadmap: SystemRoadmapRepository,
    @Inject(AUTOMATION_NOTIFICATION_PORT)
    private readonly notifications: AutomationNotificationPort,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  async evaluate(input: {
    signals: Readonly<Record<string, number>>;
    resourceUuid?: string;
  }) {
    const rules = await this.roadmap.alertRule.list(true);
    const results: OperationalAlertRecord[] = [];
    for (const rule of rules) {
      const signalValue = input.signals[rule.signal] ?? 0;
      if (signalValue < rule.threshold) continue;
      const now = new Date();
      const dedupeKey = `${rule.ruleKey}:${input.resourceUuid ?? 'global'}`;
      const alert = await this.roadmap.alert.upsert({
        uuid: randomUUID(),
        alertKey: rule.ruleKey,
        severity: rule.severity,
        status: 'OPEN',
        message: `${rule.signal} threshold exceeded`,
        dedupeKey,
        resourceType: input.resourceUuid ? 'system_integration' : null,
        resourceUuid: input.resourceUuid ?? null,
        metadata: {
          signal: rule.signal,
          value: signalValue,
          threshold: rule.threshold,
        },
        firstSeenAt: now,
        lastSeenAt: now,
        resolvedAt: null,
      });
      results.push(alert);
      const targetUserUuid =
        typeof rule.metadata.targetUserUuid === 'string'
          ? rule.metadata.targetUserUuid
          : null;
      if (targetUserUuid) {
        await this.notifications.createNotification({
          userUuid: targetUserUuid,
          type: 'operational-alert',
          title: `[${rule.severity}] ${rule.ruleKey}`,
          body: `${rule.signal} is ${signalValue}, threshold ${rule.threshold}`,
          priority: rule.severity === 'CRITICAL' ? 'URGENT' : 'HIGH',
          referenceType: 'system_operational_alert',
          referenceUuid: alert.uuid,
          metadata: { ruleKey: rule.ruleKey },
        });
      }
    }
    return results;
  }

  async acknowledge(actorUuid: string, uuid: string) {
    const alerts = await this.roadmap.alert.list('OPEN', undefined, 100);
    const alert = alerts.find((item) => item.uuid === uuid);
    if (!alert) throw new NotFoundException('Operational alert not found');
    const updated = await this.roadmap.alert.upsert({
      ...alert,
      status: 'ACKNOWLEDGED',
      metadata: { ...alert.metadata, acknowledgedBy: actorUuid },
    });
    await this.audit.record({
      action: 'SYSTEM_SETTING_UPDATED',
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'system_operational_alert',
      entityUuid: uuid,
      result: 'SUCCESS',
      reason: 'operational-alert-acknowledged',
    });
    return updated;
  }
}
