import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { IntegrationState } from '../../domain/integration/integration.contracts.js';
import type { IntegrationCredentialStatus } from '../../domain/integration/integration-operation.contracts.js';
import type {
  FeatureFlagRecord,
  ImportProfileRecord,
  IntegrationConflictRecord,
  IntegrationCredentialRecord,
  IntegrationEventRecord,
  IntegrationIdempotencyRecord,
  IntegrationOperationRecord,
  IntegrationRuntimeRecord,
  OperationalAlertRecord,
  OperationalAlertRuleRecord,
  SystemRoadmapRepository,
} from '../../domain/repositories/system-roadmap.repository.js';

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const CREDENTIAL_STATUSES = [
  'ACTIVE',
  'EXPIRED',
  'REVOKED',
  'ROTATED',
] as const satisfies readonly IntegrationCredentialStatus[];

const credentialStatus = (value: string): IntegrationCredentialStatus => {
  if ((CREDENTIAL_STATUSES as readonly string[]).includes(value))
    return value as IntegrationCredentialStatus;
  throw new Error(`Invalid integration credential status: ${value}`);
};

const credentialRecord = <T extends { status: string; metadata: unknown }>(
  row: T,
) => ({
  ...row,
  status: credentialStatus(row.status),
  metadata: object(row.metadata),
});

@Injectable()
export class PrismaSystemRoadmapRepository implements SystemRoadmapRepository {
  constructor(private readonly prisma: PrismaService) {}

  featureFlag = {
    list: async (environment?: string) => {
      const rows = await this.prisma.systemFeatureFlag.findMany({
        where: environment ? { environment } : {},
        orderBy: { key: 'asc' },
      });
      return rows.map((row) => ({ ...row, metadata: object(row.metadata) }));
    },
    get: async (key: string, environment: string) => {
      const row = await this.prisma.systemFeatureFlag.findUnique({
        where: { key_environment: { key, environment } },
      });
      return row ? { ...row, metadata: object(row.metadata) } : null;
    },
    upsert: async (
      input: Omit<FeatureFlagRecord, 'createdAt' | 'updatedAt'>,
    ) => {
      const row = await this.prisma.systemFeatureFlag.upsert({
        where: {
          key_environment: { key: input.key, environment: input.environment },
        },
        create: input as never,
        update: {
          ...input,
          uuid: undefined,
          createdBy: undefined,
        } as never,
      });
      return { ...row, metadata: object(row.metadata) };
    },
  };

  importProfile = {
    create: async (
      input: Omit<ImportProfileRecord, 'createdAt' | 'updatedAt'>,
    ) => {
      const row = await this.prisma.systemImportProfile.create({
        data: input as never,
      });
      return {
        ...row,
        columnMapping: object(row.columnMapping),
        fieldMapping: object(row.fieldMapping),
      };
    },
    list: async (entity?: string, active?: boolean) => {
      const rows = await this.prisma.systemImportProfile.findMany({
        where: {
          ...(entity ? { entity } : {}),
          ...(active === undefined ? {} : { active }),
        },
        orderBy: [{ entity: 'asc' }, { version: 'desc' }],
      });
      return rows.map((row) => ({
        ...row,
        columnMapping: object(row.columnMapping),
        fieldMapping: object(row.fieldMapping),
      }));
    },
    get: async (uuid: string) => {
      const row = await this.prisma.systemImportProfile.findUnique({
        where: { uuid },
      });
      return row
        ? {
            ...row,
            columnMapping: object(row.columnMapping),
            fieldMapping: object(row.fieldMapping),
          }
        : null;
    },
    update: async (
      uuid: string,
      input: Partial<
        Omit<ImportProfileRecord, 'uuid' | 'createdAt' | 'updatedAt'>
      >,
    ) => {
      const row = await this.prisma.systemImportProfile.update({
        where: { uuid },
        data: input as never,
      });
      return {
        ...row,
        columnMapping: object(row.columnMapping),
        fieldMapping: object(row.fieldMapping),
      };
    },
  };

  credential = {
    get: async (uuid: string) => {
      const row = await this.prisma.systemIntegrationCredential.findUnique({
        where: { uuid },
      });
      return row ? credentialRecord(row) : null;
    },
    list: async (integrationId: bigint, credentialType?: string) => {
      const rows = await this.prisma.systemIntegrationCredential.findMany({
        where: {
          integrationId,
          ...(credentialType ? { credentialType } : {}),
        },
        orderBy: [{ credentialType: 'asc' }, { version: 'desc' }],
      });
      return rows.map(credentialRecord);
    },
    create: async (
      input: Omit<IntegrationCredentialRecord, 'issuedAt' | 'lastUsedAt'> &
        Partial<
          Pick<
            IntegrationCredentialRecord,
            'accessTokenRef' | 'refreshTokenRef'
          >
        >,
    ) => {
      const row = await this.prisma.systemIntegrationCredential.create({
        data: input as never,
      });
      return credentialRecord(row);
    },
    revoke: async (uuid: string, revokedAt: Date) => {
      const row = await this.prisma.systemIntegrationCredential.update({
        where: { uuid },
        data: { status: 'REVOKED', revokedAt },
      });
      return credentialRecord(row);
    },
    markUsed: async (uuid: string, lastUsedAt: Date) => {
      const row = await this.prisma.systemIntegrationCredential.update({
        where: { uuid },
        data: { lastUsedAt },
      });
      return credentialRecord(row);
    },
    rotate: async (
      uuid: string,
      input: {
        secretRef?: string | null;
        accessTokenRef?: string | null;
        refreshTokenRef?: string | null;
        accessTokenExpiresAt?: Date | null;
        refreshTokenExpiresAt?: Date | null;
        metadata?: Record<string, unknown>;
      },
    ) => {
      const row = await this.prisma.$transaction(async (tx) => {
        const current = await tx.systemIntegrationCredential.findUniqueOrThrow({
          where: { uuid },
        });
        await tx.systemIntegrationCredential.update({
          where: { uuid },
          data: { status: 'ROTATED', rotatedAt: new Date() },
        });
        return tx.systemIntegrationCredential.create({
          data: {
            uuid: randomUUID(),
            integrationId: current.integrationId,
            credentialType: current.credentialType,
            secretRef: input.secretRef ?? current.secretRef,
            accessTokenRef: input.accessTokenRef ?? null,
            refreshTokenRef: input.refreshTokenRef ?? null,
            version: current.version + 1,
            status: 'ACTIVE',
            accessTokenExpiresAt: input.accessTokenExpiresAt ?? null,
            refreshTokenExpiresAt: input.refreshTokenExpiresAt ?? null,
            metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          },
        });
      });
      return credentialRecord(row);
    },
  };

  runtime = {
    getOrCreate: async (integrationId: bigint) => {
      const row = await this.prisma.systemIntegrationRuntime.findUnique({
        where: { integrationId },
      });
      if (row) {
        return {
          ...row,
          requestMapping: object(row.requestMapping),
          responseMapping: object(row.responseMapping),
          metadata: object(row.metadata),
        };
      }
      const created = await this.prisma.systemIntegrationRuntime.create({
        data: {
          uuid: randomUUID(),
          integrationId,
          requestMapping: {},
          responseMapping: {},
          metadata: {},
        },
      });
      return {
        ...created,
        requestMapping: object(created.requestMapping),
        responseMapping: object(created.responseMapping),
        metadata: object(created.metadata),
      };
    },
    update: async (
      integrationId: bigint,
      input: Partial<Omit<IntegrationRuntimeRecord, 'uuid' | 'integrationId'>>,
    ) => {
      const row = await this.prisma.systemIntegrationRuntime.update({
        where: { integrationId },
        data: input as never,
      });
      return {
        ...row,
        requestMapping: object(row.requestMapping),
        responseMapping: object(row.responseMapping),
        metadata: object(row.metadata),
      };
    },
  };

  operation = {
    getByIdempotency: async (integrationId: bigint, idempotencyKey: string) => {
      const row = await this.prisma.systemIntegrationOperation.findUnique({
        where: {
          integrationId_idempotencyKey: {
            integrationId,
            idempotencyKey,
          },
        },
      });
      return row
        ? {
            ...row,
            requestPayload: object(row.requestPayload),
            responsePayload: object(row.responsePayload),
            metadata: object(row.metadata),
          }
        : null;
    },
    create: async (input: IntegrationOperationRecord) => {
      const row = await this.prisma.systemIntegrationOperation.create({
        data: input as never,
      });
      return {
        ...row,
        requestPayload: object(row.requestPayload),
        responsePayload: object(row.responsePayload),
        metadata: object(row.metadata),
      };
    },
    update: async (
      uuid: string,
      input: Partial<Omit<IntegrationOperationRecord, 'uuid'>>,
    ) => {
      const row = await this.prisma.systemIntegrationOperation.update({
        where: { uuid },
        data: input as never,
      });
      return {
        ...row,
        requestPayload: object(row.requestPayload),
        responsePayload: object(row.responsePayload),
        metadata: object(row.metadata),
      };
    },
    list: async (integrationId: bigint, state?: string, limit = 50) => {
      const rows = await this.prisma.systemIntegrationOperation.findMany({
        where: { integrationId, ...(state ? { state } : {}) },
        orderBy: { createdAt: 'desc' },
        take: Math.min(100, Math.max(1, limit)),
      });
      return rows.map((row) => ({
        ...row,
        requestPayload: object(row.requestPayload),
        responsePayload: object(row.responsePayload),
        metadata: object(row.metadata),
      }));
    },
  };

  event = {
    create: async (input: IntegrationEventRecord) => {
      const row = await this.prisma.systemIntegrationEvent.create({
        data: input as never,
      });
      return { ...row, payload: object(row.payload) };
    },
    getByKey: async (integrationId: bigint, eventKey: string) => {
      const row = await this.prisma.systemIntegrationEvent.findUnique({
        where: { integrationId_eventKey: { integrationId, eventKey } },
      });
      return row ? { ...row, payload: object(row.payload) } : null;
    },
    update: async (
      uuid: string,
      input: Partial<Omit<IntegrationEventRecord, 'uuid'>>,
    ) => {
      const row = await this.prisma.systemIntegrationEvent.update({
        where: { uuid },
        data: input as never,
      });
      return { ...row, payload: object(row.payload) };
    },
    list: async (integrationId: bigint, status?: string, limit = 50) => {
      const rows = await this.prisma.systemIntegrationEvent.findMany({
        where: { integrationId, ...(status ? { status } : {}) },
        orderBy: { occurredAt: 'desc' },
        take: Math.min(100, Math.max(1, limit)),
      });
      return rows.map((row) => ({ ...row, payload: object(row.payload) }));
    },
  };

  idempotency = {
    reserve: async (
      input: Omit<IntegrationIdempotencyRecord, 'createdAt' | 'updatedAt'>,
    ) => {
      try {
        const row = await this.prisma.systemIntegrationIdempotency.create({
          data: input as never,
        });
        return { record: row, created: true };
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const row =
            await this.prisma.systemIntegrationIdempotency.findUniqueOrThrow({
              where: {
                integrationId_eventKey_eventName_eventVersion: {
                  integrationId: input.integrationId,
                  eventKey: input.eventKey,
                  eventName: input.eventName,
                  eventVersion: input.eventVersion,
                },
              },
            });
          return { record: row, created: false };
        }
        throw error;
      }
    },
    update: async (
      uuid: string,
      input: Partial<
        Omit<IntegrationIdempotencyRecord, 'uuid' | 'integrationId'>
      >,
    ) =>
      this.prisma.systemIntegrationIdempotency.update({
        where: { uuid },
        data: input as never,
      }),
  };

  conflict = {
    upsert: async (input: IntegrationConflictRecord) => {
      const row = await this.prisma.systemIntegrationConflict.upsert({
        where: {
          integrationId_conflictKey: {
            integrationId: input.integrationId,
            conflictKey: input.conflictKey,
          },
        },
        create: input as never,
        update: input as never,
      });
      return {
        ...row,
        localPayload: object(row.localPayload),
        remotePayload: object(row.remotePayload),
      };
    },
    get: async (integrationId: bigint, conflictKey: string) => {
      const row = await this.prisma.systemIntegrationConflict.findUnique({
        where: { integrationId_conflictKey: { integrationId, conflictKey } },
      });
      return row
        ? {
            ...row,
            localPayload: object(row.localPayload),
            remotePayload: object(row.remotePayload),
          }
        : null;
    },
    list: async (integrationId: bigint, status?: string, limit = 50) => {
      const rows = await this.prisma.systemIntegrationConflict.findMany({
        where: { integrationId, ...(status ? { status } : {}) },
        orderBy: { createdAt: 'desc' },
        take: Math.min(100, Math.max(1, limit)),
      });
      return rows.map((row) => ({
        ...row,
        localPayload: object(row.localPayload),
        remotePayload: object(row.remotePayload),
      }));
    },
    resolve: async (
      integrationId: bigint,
      conflictKey: string,
      input: { resolution: string; resolvedBy: string },
    ) => {
      const row = await this.prisma.systemIntegrationConflict.update({
        where: { integrationId_conflictKey: { integrationId, conflictKey } },
        data: {
          resolution: input.resolution,
          status: 'RESOLVED',
          resolvedBy: input.resolvedBy,
          resolvedAt: new Date(),
        },
      });
      return {
        ...row,
        localPayload: object(row.localPayload),
        remotePayload: object(row.remotePayload),
      };
    },
  };

  alertRule = {
    list: async (enabled?: boolean) => {
      const rows = await this.prisma.systemOperationalAlertRule.findMany({
        where: enabled === undefined ? {} : { enabled },
        orderBy: { ruleKey: 'asc' },
      });
      return rows.map((row) => ({ ...row, metadata: object(row.metadata) }));
    },
    upsert: async (input: OperationalAlertRuleRecord) => {
      const row = await this.prisma.systemOperationalAlertRule.upsert({
        where: { ruleKey: input.ruleKey },
        create: input as never,
        update: input as never,
      });
      return { ...row, metadata: object(row.metadata) };
    },
  };

  alert = {
    upsert: async (input: OperationalAlertRecord) => {
      const row = await this.prisma.systemOperationalAlert.upsert({
        where: { dedupeKey: input.dedupeKey },
        create: input as never,
        update: input as never,
      });
      return { ...row, metadata: object(row.metadata) };
    },
    list: async (status?: string, severity?: string, limit = 50) => {
      const rows = await this.prisma.systemOperationalAlert.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(severity ? { severity } : {}),
        },
        orderBy: { lastSeenAt: 'desc' },
        take: Math.min(100, Math.max(1, limit)),
      });
      return rows.map((row) => ({ ...row, metadata: object(row.metadata) }));
    },
    resolve: async (uuid: string) => {
      const row = await this.prisma.systemOperationalAlert.update({
        where: { uuid },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });
      return { ...row, metadata: object(row.metadata) };
    },
  };

  async aggregate() {
    const [
      featureFlags,
      importProfiles,
      integrations,
      openConflicts,
      openAlerts,
      runningOperations,
      pendingEvents,
    ] = await Promise.all([
      this.prisma.systemFeatureFlag.count(),
      this.prisma.systemImportProfile.count(),
      this.prisma.systemIntegration.groupBy({
        by: ['state'],
        _count: { _all: true },
      }),
      this.prisma.systemIntegrationConflict.count({
        where: { status: 'OPEN' },
      }),
      this.prisma.systemOperationalAlert.count({
        where: { status: 'OPEN' },
      }),
      this.prisma.systemIntegrationOperation.count({
        where: { state: { in: ['QUEUED', 'RUNNING', 'RETRY_SCHEDULED'] } },
      }),
      this.prisma.systemIntegrationEvent.count({
        where: { status: { in: ['PENDING', 'RECEIVED'] } },
      }),
    ]);

    const states: Record<IntegrationState, number> = {
      CONFIGURED: 0,
      ACTIVE: 0,
      DISABLED: 0,
      ERROR: 0,
      DISCONNECTED: 0,
    };
    for (const row of integrations) {
      if (row.state in states) {
        states[row.state as IntegrationState] = row._count._all;
      }
    }
    return {
      featureFlags,
      importProfiles,
      integrations: states,
      openConflicts,
      openAlerts,
      runningOperations,
      pendingEvents,
    };
  }
}
