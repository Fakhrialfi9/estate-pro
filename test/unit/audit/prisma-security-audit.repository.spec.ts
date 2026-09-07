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

type AuditTransaction = {
  authenticationUser: {
    findFirst: ReturnType<
      typeof vi.fn<
        (args: unknown) => Promise<{ id: bigint; uuid: string } | null>
      >
    >;
  };
  authorizationRole: {
    findFirst: ReturnType<
      typeof vi.fn<
        (args: unknown) => Promise<{ id: bigint; uuid: string } | null>
      >
    >;
  };
  authorizationPermission: {
    findFirst: ReturnType<
      typeof vi.fn<
        (args: unknown) => Promise<{ id: bigint; uuid: string } | null>
      >
    >;
  };
  auditLog: {
    create: ReturnType<
      typeof vi.fn<(args: AuditLogCreateArgs) => Promise<{ id: bigint }>>
    >;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  auditLogChange: {
    createMany: ReturnType<
      typeof vi.fn<(args: AuditChangeCreateManyArgs) => Promise<void>>
    >;
  };
};

type TransactionCallback = (
  value: AuditTransaction,
) => Promise<unknown> | unknown;

type TransactionMock = ReturnType<typeof vi.fn<(callback: TransactionCallback) => Promise<unknown>>>;

const createTransaction = (
  actorUuid: string,
  auditLogCreate: ReturnType<
    typeof vi.fn<(args: AuditLogCreateArgs) => Promise<{ id: bigint }>>
  >,
  auditLogChangeCreateMany?: ReturnType<
    typeof vi.fn<(args: AuditChangeCreateManyArgs) => Promise<void>>
  >,
): AuditTransaction => ({
  authenticationUser: {
    findFirst: vi
      .fn<
        (args: unknown) => Promise<{ id: bigint; uuid: string } | null>
      >()
      .mockResolvedValue({
        id: 7n,
        uuid: actorUuid,
      }),
  },
  authorizationRole: {
    findFirst: vi
      .fn<
        (args: unknown) => Promise<{ id: bigint; uuid: string } | null>
      >()
      .mockResolvedValue(null),
  },
  authorizationPermission: {
    findFirst: vi
      .fn<
        (args: unknown) => Promise<{ id: bigint; uuid: string } | null>
      >()
      .mockResolvedValue(null),
  },
  auditLog: {
    create: auditLogCreate,
    findMany: vi.fn(),
    count: vi.fn(),
  },
  auditLogChange: {
    createMany:
      auditLogChangeCreateMany ??
      vi.fn<(args: AuditChangeCreateManyArgs) => Promise<void>>().mockResolvedValue(undefined),
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
      .fn<(args: AuditLogCreateArgs) => Promise<{ id: bigint }>>()
      .mockResolvedValue({ id: 1n });
    const tx = createTransaction(actorUuid, auditLogCreate);
    const transaction = vi
      .fn<TransactionCallback>()
      .mockImplementation((callback) => Promise.resolve(callback(tx)));
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
      .fn<(args: AuditLogCreateArgs) => Promise<{ id: bigint }>>()
      .mockResolvedValue({ id: 1n });
    const auditLogChangeCreateMany = vi
      .fn<(args: AuditChangeCreateManyArgs) => Promise<void>>()
      .mockResolvedValue(undefined);
    const tx = createTransaction(
      actorUuid,
      auditLogCreate,
      auditLogChangeCreateMany,
    );
    const transaction = vi
      .fn<TransactionCallback>()
      .mockImplementation((callback) => Promise.resolve(callback(tx)));
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
    const transaction = vi.fn<TransactionCallback>();
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
