import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import {
  SystemSettingConflictError,
  SystemSettingImmutableError,
} from '../../domain/errors/system.errors.js';
import type { SystemSettingsRepository } from '../../domain/repositories/system-settings.repository.js';
import type { SystemSettingRecord } from '../../domain/system.types.js';

const toRecord = (row: {
  uuid: string;
  key: string;
  scope: string;
  scopeKey: string;
  valueType: string;
  value: string;
  mutable: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): SystemSettingRecord => ({
  uuid: row.uuid,
  key: row.key,
  scope: row.scope,
  scopeKey: row.scopeKey,
  valueType: row.valueType as SystemSettingRecord['valueType'],
  value: row.value,
  mutable: row.mutable,
  version: row.version,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

@Injectable()
export class PrismaSystemSettingsRepository
  implements SystemSettingsRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async get(key: string, scope: string, scopeKey: string) {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key_scope_scopeKey: { key, scope, scopeKey } },
    });
    return row ? toRecord(row) : null;
  }

  async list(scope: string, scopeKey: string, page: number, limit: number) {
    const where = { scope, scopeKey };
    const [items, total] = await Promise.all([
      this.prisma.systemSetting.findMany({
        where,
        orderBy: { key: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.systemSetting.count({ where }),
    ]);
    return { items: items.map(toRecord), total };
  }

  async upsert(input: {
    key: string;
    scope: string;
    scopeKey: string;
    valueType: string;
    value: string;
    mutable: boolean;
    expectedVersion?: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.systemSetting.findUnique({
        where: {
          key_scope_scopeKey: {
            key: input.key,
            scope: input.scope,
            scopeKey: input.scopeKey,
          },
        },
      });

      if (current && current.mutable === false) {
        throw new SystemSettingImmutableError(input.key);
      }
      if (
        current &&
        input.expectedVersion !== undefined &&
        current.version !== input.expectedVersion
      ) {
        throw new SystemSettingConflictError(input.key);
      }

      if (!current) {
        const row = await tx.systemSetting.create({
          data: {
            uuid: randomUUID(),
            key: input.key,
            scope: input.scope,
            scopeKey: input.scopeKey,
            valueType: input.valueType,
            value: input.value,
            mutable: input.mutable,
            version: 1,
          },
        });
        return toRecord(row);
      }

      const expectedVersion = input.expectedVersion ?? current.version;
      const updated = await tx.systemSetting.updateMany({
        where: {
          id: current.id,
          version: expectedVersion,
          mutable: true,
        },
        data: {
          value: input.value,
          valueType: input.valueType,
          mutable: input.mutable,
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new SystemSettingConflictError(input.key);
      }

      const row = await tx.systemSetting.findUniqueOrThrow({
        where: { id: current.id },
      });
      return toRecord(row);
    });
  }
}
