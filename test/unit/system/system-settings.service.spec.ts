import { describe, expect, beforeEach, it, vi } from 'vitest';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SystemSettingsService } from '../../../src/modules/system/application/services/system-settings.service.js';
import type { SystemSettingsRepository } from '../../../src/modules/system/domain/repositories/system-settings.repository.js';
import type { SystemActivityRepository } from '../../../src/modules/system/domain/repositories/system-activity.repository.js';
import type { SecurityAuditRepository } from '../../../src/common/audit/security-audit.port.js';
import type { SystemCachePort } from '../../../src/modules/system/cache/system-cache.port.js';
import type { SystemSettingRecord } from '../../../src/modules/system/domain/system.types.js';
import { SystemSettingConflictError } from '../../../src/modules/system/domain/errors/system.errors.js';

const actorUuid = '11111111-1111-4111-8111-111111111111';
const setting = (
  overrides: Partial<SystemSettingRecord> = {},
): SystemSettingRecord => ({
  uuid: '22222222-2222-4222-8222-222222222222',
  key: 'system.maintenance_mode',
  scope: 'GLOBAL',
  scopeKey: 'global',
  valueType: 'BOOLEAN',
  value: 'true',
  mutable: true,
  version: 3,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-02T00:00:00Z'),
  ...overrides,
});

describe('SystemSettingsService', () => {
  const repository = {
    get: vi.fn(),
    list: vi.fn(),
    upsert: vi.fn(),
  } as unknown as SystemSettingsRepository;
  const audit = {
    record: vi.fn().mockResolvedValue(undefined),
  } as SecurityAuditRepository;
  const activity = {
    append: vi.fn().mockResolvedValue(undefined),
  } as unknown as SystemActivityRepository;
  const cache = {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as SystemCachePort;
  const service = new SystemSettingsService(repository, audit, activity, cache);

  beforeEach(() => {
    vi.clearAllMocks();
    repository.get = vi.fn();
    repository.list = vi.fn();
    repository.upsert = vi.fn();
    cache.get = vi.fn();
    cache.set = vi.fn().mockResolvedValue(undefined);
    cache.delete = vi.fn().mockResolvedValue(undefined);
  });

  it('clamps list pagination and deserializes stored values', async () => {
    repository.list.mockResolvedValue({ items: [setting()], total: 101 });
    await expect(service.list(0, 500)).resolves.toMatchObject({
      items: [expect.objectContaining({ value: true })],
      meta: { page: 1, limit: 100, totalPages: 2 },
    });
    expect(repository.list).toHaveBeenCalledWith('GLOBAL', 'global', 1, 100);
  });

  it('falls back to the database when cache read and write fail', async () => {
    cache.get.mockRejectedValue(new Error('cache unavailable'));
    cache.set.mockRejectedValue(new Error('cache unavailable'));
    repository.get.mockResolvedValue(null);
    await expect(
      service.get(' system.maintenance_mode '),
    ).resolves.toMatchObject({
      key: 'system.maintenance_mode',
      value: false,
      valueType: 'BOOLEAN',
    });
    expect(repository.get).toHaveBeenCalledWith(
      'system.maintenance_mode',
      'GLOBAL',
      'global',
    );
  });

  it('returns cached settings without querying the repository', async () => {
    const cached = {
      key: 'system.maintenance_mode',
      scope: 'GLOBAL',
      scopeKey: 'global',
      valueType: 'BOOLEAN',
      value: true,
    };
    cache.get.mockResolvedValue(cached);
    await expect(service.get('system.maintenance_mode')).resolves.toBe(cached);
    expect(repository.get).not.toHaveBeenCalled();
  });

  it('maps invalid updates and repository conflicts to application errors', async () => {
    await expect(
      service.update('system.maintenance_mode', 'yes', actorUuid),
    ).rejects.toBeInstanceOf(BadRequestException);
    repository.upsert.mockRejectedValue(
      new SystemSettingConflictError('system.maintenance_mode'),
    );
    await expect(
      service.update('system.maintenance_mode', 'false', actorUuid, 3),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('updates, invalidates cache, and records audit and activity events', async () => {
    repository.upsert.mockResolvedValue(
      setting({ value: 'false', version: 4 }),
    );
    await expect(
      service.update('system.maintenance_mode', ' false ', actorUuid, 3),
    ).resolves.toMatchObject({
      key: 'system.maintenance_mode',
      value: false,
      version: 4,
    });
    expect(cache.delete).toHaveBeenCalledWith(
      'system:settings:system.maintenance_mode',
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SYSTEM_SETTING_UPDATED',
        actorUuid,
        entityUuid: setting().uuid,
      }),
    );
    expect(activity.append).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SYSTEM_SETTING_UPDATED',
        actorUuid,
        resourceUuid: setting().uuid,
      }),
    );
  });

  it('rejects unknown settings before touching cache or repository', async () => {
    await expect(service.get('system.unknown')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(cache.get).not.toHaveBeenCalled();
    expect(repository.get).not.toHaveBeenCalled();
  });
});
