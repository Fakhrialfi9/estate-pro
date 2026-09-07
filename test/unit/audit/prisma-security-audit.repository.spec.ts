import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../prisma/generated/prisma/client.js';
import type { ConfigService } from '@nestjs/config';
import { PrismaSecurityAuditRepository } from '../../../src/infrastructure/audit/prisma-security-audit.repository.js';
import type { SecurityAuditEvent } from '../../../src/common/audit/security-audit.port.js';
import type { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js';

type AuditLogCreateArgs = {
  data: {
    uuid: string;
    actorUserId: bigint | null;
    userId: bigint | null;
    action: string;
    actorType: string;
    entityType: string | null;
    entityId: bigint | null;
    resourceId: string | null;
    result: string;
    reason: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    requestId: string | null;
  };
};

type AuditChangeCreateManyArgs = {
  data: readonly {
    auditLogId: bigint;
    field: string;
    oldValue: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    newValue: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  }[];
};

type UserFindFirst = (
  args: unknown,
) => Promise<{ id: bigint; uuid: string } | null>;

type AuditLogCreate = (
  args: AuditLogCreateArgs,
) => Promise<{ id: bigint }>;

type AuditLogChangeCreateMany = (
  args: AuditChangeCreateManyArgs,
) => Promise<void>;

type AuditTransaction = {
  authenticationUser: { findFirst: UserFindFirst };
  authorizationRole: { findFirst: UserFindFirst };
  authorizationPermission: { findFirst: UserFindFirst };
  auditLog: {
    create: AuditLogCreate;
    findMany: (args: unknown) => Promise<unknown>;
    count: (args: unknown) => Promise<number>;
  };
  auditLogChange: { createMany: AuditLogChangeCreateMany };
};

type TransactionCallback = <T>(
  value: AuditTransaction,
) => Promise<T>;

type TransactionMock = <T>(callback: (value: AuditTransaction) => Promise<T>) => Promise<T>;

const createTransaction = (
  actorUuid: string,
  auditLogCreate: AuditLogCreate,
  auditLogChangeCreateMany?: AuditLogChangeCreateMany,
): AuditTransaction => ({
  authenticationUser: {
    findFirst: vi.fn<UserFindFirst>().mockResolvedValue({
      id: 7n,
      uuid: actorUuid,
    }),
  },
  authorizationRole: {
    findFirst: vi.fn<UserFindFirst>().mockResolvedValue(null),
  },
  authorizationPermission: {
    findFirst: vi.fn<UserFindFirst>().mockResolvedValue(null),
  },
  auditLog: {
    create: auditLogCreate,
    findMany: vi.fn<(args: unknown) => Promise<unknown>>().mockResolvedValue([]),
    count: vi.fn<(args: unknown) => Promise<number>>().mockResolvedValue(0),
  },
  auditLogChange: {
    createMany:
      auditLogChangeCreateMany ??
      vi.fn<AuditLogChangeCreateMany>().mockResolvedValue(undefined),
  },
});

const createRepository = (
  transaction: TransactionMock,
): PrismaSecurityAuditRepository => {
  const prisma = { $transaction: transaction } as unknown as PrismaService;
  const configGet = vi.fn<() => number>().mockReturnValue(1024);
  const config = { get: configGet } as unknown as ConfigService;
  return new PrismaSecurityAuditRepository(prisma, config);
};

describe('PrismaSecurityAuditRepository', () => {
  it('accepts authentication refresh-token audit actions and persists the event', async () => {
    const actorUuid = randomUUID();
    const auditLogCreate = vi
      .fn<AuditLogCreate>()
      .mockResolvedValue({ id: 1n });
    const tx = createTransaction(actorUuid, auditLogCreate);
    const transaction = vi.fn<TransactionMock>().mockImplementation((callback) =>
      callback(tx),
    );
    const repository = createRepository(transaction);
    const event: SecurityAuditEvent = {
      action: 'REFRESH_TOKEN_ISSUED',
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'authentication_refresh_token',
      result: 'SUCCESS',
      requestId: 'refresh-issue-request',
    };

    await repository.record(event);

    expect(transaction).toHaveBeenCalledOnce();
    expect(auditLogCreate).toHaveBeenCalledOnce();
    const call = auditLogCreate.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call?.data.action).toBe('REFRESH_TOKEN_ISSUED');
    expect(call?.data.entityType).toBe('authentication_refresh_token');
    expect(call?.data.resourceId).toBeNull();
    expect(call?.data.result).toBe('SUCCESS');
    expect(call?.data.requestId).toBe('refresh-issue-request');
  });

  it('accepts property utilities audit events and persists sanitized changes', async () => {
    const actorUuid = randomUUID();
    const auditLogCreate = vi
      .fn<AuditLogCreate>()
      .mockResolvedValue({ id: 1n });
    const auditLogChangeCreateMany = vi
      .fn<AuditLogChangeCreateMany>()
      .mockResolvedValue(undefined);
    const tx = createTransaction(
      actorUuid,
      auditLogCreate,
      auditLogChangeCreateMany,
    );
    const transaction = vi.fn<TransactionMock>().mockImplementation((callback) =>
      callback(tx),
    );
    const repository = createRepository(transaction);
    const entityUuid = randomUUID();
    const event: SecurityAuditEvent = {
      action: 'property.utilities.update',
      actorUuid,
      subjectUuid: actorUuid,
      actorType: 'AUTHENTICATED',
      entityType: 'property_utilities',
      entityUuid,
      requestId: 'request-123',
      result: 'SUCCESS',
      changes: [
        { field: 'electricityProvider', oldValue: null, newValue: 'PLN' },
        {
          field: 'electricityMeterNumberMasked',
          oldValue: null,
          newValue: '1234****5678',
        },
        {
          field: 'password',
          oldValue: null,
          newValue: 'must-not-be-recorded',
        },
      ],
    };

    await repository.record(event);

    expect(transaction).toHaveBeenCalledOnce();
    expect(auditLogCreate).toHaveBeenCalledOnce();
    const call = auditLogCreate.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call?.data.action).toBe('property.utilities.update');
    expect(call?.data.entityType).toBe('property_utilities');
    expect(call?.data.entityId).toBeNull();
    expect(call?.data.resourceId).toBe(entityUuid);
    expect(call?.data.result).toBe('SUCCESS');

    expect(auditLogChangeCreateMany).toHaveBeenCalledWith({
      data: [
        {
          auditLogId: 1n,
          field: 'electricityProvider',
          oldValue: Prisma.JsonNull,
          newValue: 'PLN',
        },
      ],
    });
  });

  it('rejects unknown audit resources', async () => {
    const transaction = vi.fn<TransactionMock>();
    const repository = createRepository(transaction);

    await expect(
      repository.record({
        action: 'property.utilities.update',
        entityType: 'property_unknown',
        entityUuid: randomUUID(),
      }),
    ).rejects.toThrow('Unsupported audit resource');
  });
});
