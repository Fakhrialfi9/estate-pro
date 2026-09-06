import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemNotificationService } from '../../src/modules/system/application/services/system-notification.service.js';

const depsFactory = () => ({
  listNotifications: vi.fn().mockResolvedValue({ items: [{ uuid: 'n1' }], total: 1 }),
  markNotificationRead: vi.fn().mockResolvedValue({ uuid: 'n1', read: true }),
  markAllNotificationsRead: vi.fn().mockResolvedValue({ updated: 2 }),
  listPreferences: vi.fn().mockResolvedValue([{ notificationType: 'LEAD', channel: 'EMAIL', enabled: true }]),
  setPreference: vi.fn().mockImplementation(async (input) => input),
  listTemplates: vi.fn().mockResolvedValue([{ code: 'welcome' }]),
  createTemplate: vi.fn().mockResolvedValue({ uuid: 't1' }),
  updateTemplate: vi.fn().mockResolvedValue({ uuid: 't1' }),
  setPolicy: vi.fn().mockResolvedValue({ uuid: 'p1' }),
  getPolicy: vi.fn().mockResolvedValue({ uuid: 'p1' }),
  createDelivery: vi.fn().mockResolvedValue({ uuid: 'd1' }),
  listDeliveries: vi.fn().mockResolvedValue([{ uuid: 'd1' }]),
});

describe('SystemNotificationService coverage', () => {
  let d: ReturnType<typeof depsFactory>;
  let service: SystemNotificationService;

  beforeEach(() => {
    d = depsFactory();
    service = new SystemNotificationService(d as never);
  });

  it('covers notification listing and read operations', async () => {
    await expect(service.list('user-1', 0, 200, true)).resolves.toMatchObject({
      total: 1,
    });
    expect(d.listNotifications).toHaveBeenCalledWith({
      page: 1,
      limit: 100,
      unreadOnly: true,
      userUuid: 'user-1',
    });
    await expect(service.markRead('user-1', 'n1')).resolves.toEqual({
      uuid: 'n1',
      read: true,
    });
    await expect(service.markAllRead('user-1')).resolves.toEqual({ updated: 2 });

    d.markNotificationRead.mockResolvedValueOnce(null);
    await expect(service.markRead('user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('validates authenticated user and delegates preferences', async () => {
    expect(() => service.preferences('')).toThrow(BadRequestException);
    expect(() =>
      service.setPreference('', {
        notificationType: 'LEAD',
        channel: 'EMAIL',
        enabled: true,
      }),
    ).toThrow(BadRequestException);
    await expect(service.preferences('user-1')).resolves.toEqual([
      { notificationType: 'LEAD', channel: 'EMAIL', enabled: true },
    ]);
    await expect(
      service.setPreference('user-1', {
        notificationType: 'LEAD',
        channel: 'EMAIL',
        enabled: false,
      }),
    ).resolves.toMatchObject({ userUuid: 'user-1', enabled: false });
  });

  it('covers template, policy and delivery delegation', async () => {
    await expect(service.templates()).resolves.toEqual([{ code: 'welcome' }]);
    await expect(service.templates({ code: 'welcome', activeOnly: true })).resolves.toEqual([
      { code: 'welcome' },
    ]);
    await expect(
      service.createTemplate({
        actorUuid: 'actor-1',
        code: 'welcome',
        version: 1,
        titleTemplate: 'Hi',
        bodyTemplate: 'Hello {{name}}',
        variables: ['name'],
      }),
    ).resolves.toEqual({ uuid: 't1' });
    await expect(
      service.updateTemplate('t1', { isActive: false }),
    ).resolves.toEqual({ uuid: 't1' });
    await expect(
      service.setPolicy('n1', { priority: 'HIGH', templateUuid: 't1' }),
    ).resolves.toEqual({ uuid: 'p1' });
    await expect(service.policy('n1')).resolves.toEqual({ uuid: 'p1' });
    await expect(service.createDelivery('n1', 'EMAIL', 3)).resolves.toEqual({
      uuid: 'd1',
    });
    await expect(service.deliveries('n1')).resolves.toEqual([{ uuid: 'd1' }]);
  });
});
