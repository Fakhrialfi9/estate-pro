import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { SystemRoadmapRepository } from '../../domain/repositories/system-roadmap.repository.js';
import type { IntegrationState } from '../../domain/integration/integration.contracts.js';

const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

@Injectable()
export class PrismaSystemRoadmapRepository implements SystemRoadmapRepository {
  constructor(private readonly prisma: PrismaService) {}

  featureFlag = {
    list: async (environment?: string) => this.prisma.systemFeatureFlag.findMany({ where: environment ? { environment } : {}, orderBy: { key: 'asc' } }).then((rows) => rows.map((row) => ({ ...row, metadata: object(row.metadata) }))),
    get: async (key: string, environment: string) => this.prisma.systemFeatureFlag.findUnique({ where: { key_environment: { key, environment } } }).then((row) => row ? { ...row, metadata: object(row.metadata) } : null),
    upsert: async (input: any) => this.prisma.systemFeatureFlag.upsert({ where: { key_environment: { key: input.key, environment: input.environment } }, create: input, update: { ...input, uuid: undefined, createdBy: undefined } }).then((row) => ({ ...row, metadata: object(row.metadata) })),
  };

  importProfile = {
    create: async (input: any) => this.prisma.systemImportProfile.create({ data: input }).then((row) => ({ ...row, columnMapping: object(row.columnMapping), fieldMapping: object(row.fieldMapping) })),
    list: async (entity?: string, active?: boolean) => this.prisma.systemImportProfile.findMany({ where: { ...(entity ? { entity } : {}), ...(active === undefined ? {} : { active }) }, orderBy: [{ entity: 'asc' }, { version: 'desc' }] }).then((rows) => rows.map((row) => ({ ...row, columnMapping: object(row.columnMapping), fieldMapping: object(row.fieldMapping) }))),
    get: async (uuid: string) => this.prisma.systemImportProfile.findUnique({ where: { uuid } }).then((row) => row ? { ...row, columnMapping: object(row.columnMapping), fieldMapping: object(row.fieldMapping) } : null),
    update: async (uuid: string, input: any) => this.prisma.systemImportProfile.update({ where: { uuid }, data: input }).then((row) => ({ ...row, columnMapping: object(row.columnMapping), fieldMapping: object(row.fieldMapping) })),
  };

  credential = {
    list: async (integrationId: bigint, credentialType?: string) => this.prisma.systemIntegrationCredential.findMany({ where: { integrationId, ...(credentialType ? { credentialType } : {}) }, orderBy: [{ credentialType: 'asc' }, { version: 'desc' }] }).then((rows) => rows.map((row) => ({ ...row, metadata: object(row.metadata) }))),
    create: async (input: any) => this.prisma.systemIntegrationCredential.create({ data: input }).then((row) => ({ ...row, metadata: object(row.metadata) })),
    revoke: async (uuid: string, revokedAt: Date) => this.prisma.systemIntegrationCredential.update({ where: { uuid }, data: { status: 'REVOKED', revokedAt } }).then((row) => ({ ...row, metadata: object(row.metadata) })),
    rotate: async (uuid: string, input: any) => this.prisma.$transaction(async (tx) => {
      const current = await tx.systemIntegrationCredential.findUniqueOrThrow({ where: { uuid } });
      await tx.systemIntegrationCredential.update({ where: { uuid }, data: { status: 'ROTATED', rotatedAt: new Date() } });
      return tx.systemIntegrationCredential.create({ data: {
        uuid: randomUUID(), integrationId: current.integrationId, credentialType: current.credentialType,
        secretRef: input.secretRef, version: current.version + 1, status: 'ACTIVE',
        accessTokenExpiresAt: input.accessTokenExpiresAt ?? null, refreshTokenExpiresAt: input.refreshTokenExpiresAt ?? null,
        metadata: input.metadata ?? {},
      } });
    }).then((row) => ({ ...row, metadata: object(row.metadata) })),
  };

  runtime = {
    getOrCreate: async (integrationId: bigint) => {
      const row = await this.prisma.systemIntegrationRuntime.findUnique({ where: { integrationId } });
      return row ? { ...row, requestMapping: object(row.requestMapping), responseMapping: object(row.responseMapping), metadata: object(row.metadata) } : this.prisma.systemIntegrationRuntime.create({ data: { uuid: randomUUID(), integrationId, requestMapping: {}, responseMapping: {}, metadata: {} } }).then((x) => ({ ...x, requestMapping: object(x.requestMapping), responseMapping: object(x.responseMapping), metadata: object(x.metadata) }));
    },
    update: async (integrationId: bigint, input: any) => this.prisma.systemIntegrationRuntime.update({ where: { integrationId }, data: input }).then((row) => ({ ...row, requestMapping: object(row.requestMapping), responseMapping: object(row.responseMapping), metadata: object(row.metadata) })),
  };

  operation = {
    getByIdempotency: async (integrationId: bigint, idempotencyKey: string) => this.prisma.systemIntegrationOperation.findUnique({ where: { integrationId_idempotencyKey: { integrationId, idempotencyKey } } }).then((row) => row ? { ...row, requestPayload: object(row.requestPayload), responsePayload: object(row.responsePayload), metadata: object(row.metadata) } : null),
    create: async (input: any) => this.prisma.systemIntegrationOperation.create({ data: input }).then((row) => ({ ...row, requestPayload: object(row.requestPayload), responsePayload: object(row.responsePayload), metadata: object(row.metadata) })),
    update: async (uuid: string, input: any) => this.prisma.systemIntegrationOperation.update({ where: { uuid }, data: input }).then((row) => ({ ...row, requestPayload: object(row.requestPayload), responsePayload: object(row.responsePayload), metadata: object(row.metadata) })),
    list: async (integrationId: bigint, state?: string, limit = 50) => this.prisma.systemIntegrationOperation.findMany({ where: { integrationId, ...(state ? { state } : {}) }, orderBy: { createdAt: 'desc' }, take: Math.min(100, Math.max(1, limit)) }).then((rows) => rows.map((row) => ({ ...row, requestPayload: object(row.requestPayload), responsePayload: object(row.responsePayload), metadata: object(row.metadata) }))),
  };

  event = {
    create: async (input: any) => this.prisma.systemIntegrationEvent.create({ data: input }).then((row) => ({ ...row, payload: object(row.payload) })),
    getByKey: async (integrationId: bigint, eventKey: string) => this.prisma.systemIntegrationEvent.findUnique({ where: { integrationId_eventKey: { integrationId, eventKey } } }).then((row) => row ? { ...row, payload: object(row.payload) } : null),
    update: async (uuid: string, input: any) => this.prisma.systemIntegrationEvent.update({ where: { uuid }, data: input }).then((row) => ({ ...row, payload: object(row.payload) })),
    list: async (integrationId: bigint, status?: string, limit = 50) => this.prisma.systemIntegrationEvent.findMany({ where: { integrationId, ...(status ? { status } : {}) }, orderBy: { occurredAt: 'desc' }, take: Math.min(100, Math.max(1, limit)) }).then((rows) => rows.map((row) => ({ ...row, payload: object(row.payload) }))),
  };

  idempotency = {
    reserve: async (input: any) => {
      try {
        const row = await this.prisma.systemIntegrationIdempotency.create({ data: {
          uuid: input.uuid, integrationId: input.integrationId, eventKey: input.eventKey, eventName: input.eventName,
          eventVersion: input.eventVersion, payloadHash: input.payloadHash, status: input.status,
          attempt: input.attempt, processedAt: input.processedAt ?? null, lastErrorCode: input.lastErrorCode ?? null,
        } });
        return { record: row, created: true };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const row = await this.prisma.systemIntegrationIdempotency.findUniqueOrThrow({ where: { integrationId_eventKey_eventName_eventVersion: {
            integrationId: input.integrationId, eventKey: input.eventKey, eventName: input.eventName, eventVersion: input.eventVersion,
          } } });
          return { record: row, created: false };
        }
        throw error;
      }
    },
    update: async (uuid: string, input: any) => this.prisma.systemIntegrationIdempotency.update({ where: { uuid }, data: input }),
  };

  conflict = {
    upsert: async (input: any) => this.prisma.systemIntegrationConflict.upsert({ where: { integrationId_conflictKey: { integrationId: input.integrationId, conflictKey: input.conflictKey } }, create: input, update: input }).then((row) => ({ ...row, localPayload: object(row.localPayload), remotePayload: object(row.remotePayload) })),
    get: async (integrationId: bigint, conflictKey: string) => this.prisma.systemIntegrationConflict.findUnique({ where: { integrationId_conflictKey: { integrationId, conflictKey } } }).then((row) => row ? { ...row, localPayload: object(row.localPayload), remotePayload: object(row.remotePayload) } : null),
    list: async (integrationId: bigint, status?: string, limit = 50) => this.prisma.systemIntegrationConflict.findMany({ where: { integrationId, ...(status ? { status } : {}) }, orderBy: { createdAt: 'desc' }, take: Math.min(100, Math.max(1, limit)) }).then((rows) => rows.map((row) => ({ ...row, localPayload: object(row.localPayload), remotePayload: object(row.remotePayload) }))),
    resolve: async (integrationId: bigint, conflictKey: string, input: any) => this.prisma.systemIntegrationConflict.update({ where: { integrationId_conflictKey: { integrationId, conflictKey } }, data: { resolution: input.resolution, status: 'RESOLVED', resolvedBy: input.resolvedBy, resolvedAt: new Date() } }).then((row) => ({ ...row, localPayload: object(row.localPayload), remotePayload: object(row.remotePayload) })),
  };

  alertRule = {
    list: async (enabled?: boolean) => this.prisma.systemOperationalAlertRule.findMany({ where: enabled === undefined ? {} : { enabled }, orderBy: { ruleKey: 'asc' } }).then((rows) => rows.map((row) => ({ ...row, metadata: object(row.metadata) }))),
    upsert: async (input: any) => this.prisma.systemOperationalAlertRule.upsert({ where: { ruleKey: input.ruleKey }, create: input, update: input }).then((row) => ({ ...row, metadata: object(row.metadata) })),
  };

  alert = {
    upsert: async (input: any) => this.prisma.systemOperationalAlert.upsert({ where: { dedupeKey: input.dedupeKey }, create: input, update: input }).then((row) => ({ ...row, metadata: object(row.metadata) })),
    list: async (status?: string, severity?: string, limit = 50) => this.prisma.systemOperationalAlert.findMany({ where: { ...(status ? { status } : {}), ...(severity ? { severity } : {}) }, orderBy: { lastSeenAt: 'desc' }, take: Math.min(100, Math.max(1, limit)) }).then((rows) => rows.map((row) => ({ ...row, metadata: object(row.metadata) }))),
    resolve: async (uuid: string) => this.prisma.systemOperationalAlert.update({ where: { uuid }, data: { status: 'RESOLVED', resolvedAt: new Date() } }).then((row) => ({ ...row, metadata: object(row.metadata) })),
  };

  async aggregate() {
    const [featureFlags, importProfiles, integrations, openConflicts, openAlerts, runningOperations, pendingEvents] = await Promise.all([
      this.prisma.systemFeatureFlag.count(), this.prisma.systemImportProfile.count(), this.prisma.systemIntegration.groupBy({ by: ['state'], _count: { _all: true } }),
      this.prisma.systemIntegrationConflict.count({ where: { status: 'OPEN' } }), this.prisma.systemOperationalAlert.count({ where: { status: 'OPEN' } }),
      this.prisma.systemIntegrationOperation.count({ where: { state: { in: ['QUEUED','RUNNING','RETRY_SCHEDULED'] } } }), this.prisma.systemIntegrationEvent.count({ where: { status: { in: ['PENDING','RECEIVED'] } } }),
    ]);
    const states: Record<IntegrationState, number> = { CONFIGURED:0, ACTIVE:0, DISABLED:0, ERROR:0, DISCONNECTED:0 };
    for (const row of integrations) if (row.state in states) states[row.state as IntegrationState] = row._count._all;
    return { featureFlags, importProfiles, integrations: states, openConflicts, openAlerts, runningOperations, pendingEvents };
  }
}
