import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi, type Mock } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { PrismaSecurityAuditRepository } from '../../../src/infrastructure/audit/prisma-security-audit.repository.js';
import type { SecurityAuditEvent } from '../../../src/common/audit/security-audit.port.js';
import type { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js';

type AuditMock = Mock;
type AuditTransaction = {
  authenticationUser: { findFirst: AuditMock };
  authorizationRole: { findFirst: AuditMock };
  authorizationPermission: { findFirst: AuditMock };
  auditLog: {
    create: AuditMock;
    findMany: AuditMock;
    count: AuditMock;
  };
  auditLogChange: { createMany: AuditMock };
};

const createTransaction = (
  actorUuid: string,
  auditLogCreate: AuditMock,
  auditLogChangeCreateMany?: AuditMock,
): AuditTransaction => ({
  authenticationUser: {
    findFirst: vi
      .fn<() => Promise<{ id: bigint; uuid: string } | null>>()
      .mockResolvedValue({
        id: 7n,
        uuid: actorUuid,
      }),
  },
  authorizationRole: { findFirst: vi.fn() },
  authorizationPermission: { findFirst: vi.fn() },
  auditLog: {
    create: auditLogCreate,
    findMany: vi.fn(),
    count: vi.fn(),
  },
  auditLogChange: {
    createMany:
      auditLogChangeCreateMany ?? vi.fn().mockResolvedValue(undefined),
  },
});

const createRepository = (
  transaction: AuditMock,
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
      .fn<() => Promise<{ id: bigint }>>()
      .mockResolvedValue({ id: 1n });
    const tx = createTransaction(actorUuid, auditLogCreate);
    const transaction = vi
      .fn<
        (callback: (value: AuditTransaction) => unknown) => Promise<unknown>
      >()
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
    expect(auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining<{
        action: string;
        entityType: string;
        resourceId: string | null;
        result: string;
        requestId: string;
      }>({
        action: 'REFRESH_TOKEN_ISSUED',
        entityType: 'authentication_refresh_token',
        resourceId: null,
        result: 'SUCCESS',
        requestId: 'refresh-issue-request',
      }),
    });
  });

  it('accepts property utilities audit events and persists sanitized changes', async () => {
    const actorUuid = randomUUID();
    const auditLogCreate = vi
      .fn<() => Promise<{ id: bigint }>>()
      .mockResolvedValue({ id: 1n });
    const auditLogChangeCreateMany = vi
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined);
    const tx = createTransaction(
      actorUuid,
      auditLogCreate,
      auditLogChangeCreateMany,
    );
    const transaction = vi
      .fn<
        (callback: (value: AuditTransaction) => unknown) => Promise<unknown>
      >()
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
    expect(auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining<{
        action: string;
        entityType: string;
        entityId: bigint | null;
        resourceId: string | null;
        result: string;
      }>({
        action: 'property.utilities.update',
        entityType: 'property_utilities',
        entityId: null,
        resourceId: entityUuid,
        result: 'SUCCESS',
      }),
    });
    expect(auditLogChangeCreateMany).toHaveBeenCalledWith({
      data: [
        {
          auditLogId: 1n,
          field: 'electricityProvider',
          oldValue: null,
          newValue: 'PLN',
        },
      ],
    });
  });

  it('rejects unknown audit resources', async () => {
    const transaction = vi.fn();
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
