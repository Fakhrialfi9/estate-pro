import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SystemSettingsService } from '../../../src/modules/system/application/services/system-settings.service.js';
import { SystemSettingConflictError, SystemSettingImmutableError } from '../../../src/modules/system/domain/errors/system.errors.js';
import { describe, expect, it, vi } from 'vitest';

const make = () => {
  const repository = {
    list: vi.fn(async () => ({ items: [], total: 0 })),
    get: vi.fn(async () => null),
    upsert: vi.fn(async (input: Record<string, unknown>) => ({ uuid: 'setting-1', key: input.key, valueType: input.valueType, value: input.value, version: 2, updatedAt: new Date('2026-01-01') })),
  };
  const cache = { get: vi.fn(async () => null), set: vi.fn(async () => undefined), delete: vi.fn(async () => undefined) };
  const audit = { record: vi.fn(async () => undefined) };
  const activity = { append: vi.fn(async () => undefined) };
  return { service: new SystemSettingsService(repository as never, audit as never, activity as never, cache as never), repository, cache, audit, activity };
};

describe('SystemSettingsService boundary coverage', () => {
  it('normalizes pagination, returns typed defaults and handles cache failures', async () => {
    const { service, repository, cache } = make();
    const listed = await service.list(0, 999);
    expect(listed.meta).toEqual({ page: 1, limit: 100, total: 0, totalPages: 0 });
    const value = await service.get(' system.default_page_size ');
    expect(value.value).toBe(25);
    expect(repository.get).toHaveBeenCalledWith('system.default_page_size', 'GLOBAL', 'global');
    cache.get.mockRejectedValueOnce(new Error('cache unavailable'));
    cache.set.mockRejectedValueOnce(new Error('cache unavailable'));
    const maintenance = await service.get('system.maintenance_mode');
    expect(maintenance.value).toBe(false);
  });

  it('rejects unknown keys and missing non-default stored values', async () => {
    const { service, repository } = make();
    await expect(service.get('unknown.setting')).rejects.toBeInstanceOf(NotFoundException);
    repository.get.mockResolvedValueOnce(null);
    await expect(service.get('system.default_page_size')).resolves.toMatchObject({ value: 25 });
    repository.get.mockResolvedValueOnce({ value: undefined });
    await expect(service.get('system.public_status_url')).resolves.toMatchObject({ value: 'https://status.example.com' });
  });

  it('validates mutable settings, handles optimistic conflicts, and records audit/activity', async () => {
    const { service, repository, cache, audit, activity } = make();
    await expect(service.update('unknown.setting', '1', 'actor')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update('system.default_page_size', '', 'actor')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('system.default_page_size', 'nope', 'actor')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('system.maintenance_mode', 'maybe', 'actor')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('system.public_status_url', 'ftp://example.com', 'actor')).rejects.toBeInstanceOf(BadRequestException);

    repository.upsert.mockRejectedValueOnce(new SystemSettingConflictError('Version conflict'));
    await expect(service.update('system.default_page_size', '50', 'actor', 1)).rejects.toBeInstanceOf(ConflictException);
    repository.upsert.mockRejectedValueOnce(new SystemSettingImmutableError('Immutable'));
    await expect(service.update('system.default_page_size', '50', 'actor', 1)).rejects.toBeInstanceOf(BadRequestException);

    cache.delete.mockRejectedValueOnce(new Error('cache unavailable'));
    const result = await service.update('system.default_page_size', '50', 'actor', 3);
    expect(result.value).toBe(50);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'SYSTEM_SETTING_UPDATED', actorUuid: 'actor' }));
    expect(activity.append).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'SYSTEM_SETTING_UPDATED', actorUuid: 'actor' }));
  });
});
