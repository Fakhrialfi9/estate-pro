import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { PrismaSecurityAuditRepository } from '../../../src/infrastructure/audit/prisma-security-audit.repository.js';
import type { SecurityAuditEvent } from '../../../src/common/audit/security-audit.port.js';
import type { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js';

describe('PrismaSecurityAuditRepository', () => {
  it('accepts property utilities audit events and persists sanitized changes', async () => {
    const actorUuid = randomUUID();
    const auditLogCreate = vi.fn().mockResolvedValue({ id: 1n });
    const auditLogChangeCreateMany = vi.fn().mockResolvedValue(undefined);

    const tx = {
      authenticationUser: {
        findFirst: vi.fn().mockResolvedValue({ id: 7n, uuid: actorUuid }),
      },
      authorizationRole: { findFirst: vi.fn() },
      authorizationPermission: { findFirst: vi.fn() },
      auditLog: {
        create: auditLogCreate,
        findMany: vi.fn(),
        count: vi.fn(),
      },
      auditLogChange: { createMany: auditLogChangeCreateMany },
      $transaction: vi.fn(),
    };

    const prisma = {
      $transaction: async (
        callback: (...args: [typeof tx]) => Promise<void>,
      ) => callback(tx),
    } as unknown as PrismaService;
    const config = {
      get: vi.fn().mockReturnValue(1024),
    } as unknown as ConfigService;

    const repository = new PrismaSecurityAuditRepository(prisma, config);
    const event: SecurityAuditEvent = {
      action: 'property.utilities.update',
      actorUuid,
      subjectUuid: actorUuid,
      actorType: 'AUTHENTICATED',
      entityType: 'property_utilities',
      entityUuid: randomUUID(),
      requestId: 'request-123',
      result: 'SUCCESS',
      changes: [
        {
          field: 'electricityProvider',
          oldValue: null,
          newValue: 'PLN',
        },
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

    expect(auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'property.utilities.update',
        entityType: 'property_utilities',
        entityId: null,
        resourceId: event.entityUuid,
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
    const prisma = {
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const config = {
      get: vi.fn().mockReturnValue(1024),
    } as unknown as ConfigService;
    const repository = new PrismaSecurityAuditRepository(prisma, config);

    await expect(
      repository.record({
        action: 'property.utilities.update',
        entityType: 'property_unknown',
        entityUuid: randomUUID(),
      }),
    ).rejects.toThrow('Unsupported audit resource');
  });
});
