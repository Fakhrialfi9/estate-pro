import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AutomationNotificationService } from '../../../src/modules/automation/application/services/automation-notification.service.js';

function createService() {
  const repository = {
    createNotification: vi.fn(),
    listPreferences: vi.fn(),
    upsertPreference: vi.fn(),
    listTemplates: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    upsertPolicy: vi.fn(),
    getPolicy: vi.fn(),
    createDelivery: vi.fn(),
    listNotificationDeliveries: vi.fn(),
  };
  return {
    service: new AutomationNotificationService(repository as never),
    repository,
  };
}

describe('AutomationNotificationService', () => {
  it('validates and creates notifications with normalized optional fields', async () => {
    const { service, repository } = createService();
    repository.createNotification.mockResolvedValue({ uuid: 'n-1' });
    await service.createNotification({
      userUuid: ' user-1 ',
      type: ' property.updated ',
      title: ' Title ',
      body: ' Body ',
      referenceType: ' property ',
      referenceUuid: 'property-1',
      metadata: { source: 'test' },
    });
    expect(repository.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userUuid: 'user-1',
        type: 'property.updated',
        title: 'Title',
        body: 'Body',
        priority: 'NORMAL',
        referenceType: 'property',
        metadata: { source: 'test' },
      }),
    );
    expect(() => service.createNotification({ userUuid: 'u' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      service.createNotification({
        userUuid: 'u',
        type: 'bad type',
        title: 't',
        body: 'b',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      service.createNotification({
        userUuid: 'u',
        type: 't',
        title: 't',
        body: 'b',
        priority: 'INVALID',
      }),
    ).toThrow(BadRequestException);
  });

  it('manages preferences and templates with validation', async () => {
    const { service, repository } = createService();
    repository.upsertPreference.mockResolvedValue({ enabled: true });
    await service.setPreference('user-1', {
      notificationType: ' property.updated ',
      channel: 'EMAIL',
      enabled: true,
    });
    expect(repository.upsertPreference).toHaveBeenCalledWith({
      userUuid: 'user-1',
      notificationType: 'property.updated',
      channel: 'EMAIL',
      enabled: true,
    });
    await expect(
      service.setPreference('', {
        notificationType: 'x',
        channel: 'EMAIL',
        enabled: true,
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.setPreference('u', {
        notificationType: 'x',
        channel: 'PUSH' as never,
        enabled: true,
      }),
    ).rejects.toThrow(BadRequestException);

    repository.createTemplate.mockResolvedValue({ uuid: 'template-1' });
    await service.createTemplate({
      code: ' property.v1 ',
      version: 1,
      titleTemplate: ' Title ',
      bodyTemplate: ' Hello {{name}} ',
      variables: ['name', 'name'],
      actorUuid: 'a',
    });
    expect(repository.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'property.v1',
        variables: ['name'],
        isActive: true,
      }),
    );
    await expect(
      service.createTemplate({
        code: 'bad code',
        version: 1,
        titleTemplate: 't',
        bodyTemplate: 'b',
        variables: [],
        actorUuid: 'a',
      }),
    ).rejects.toThrow(BadRequestException);
    repository.updateTemplate.mockResolvedValue({ uuid: 'template-1' });
    await service.updateTemplate('template-1', {
      titleTemplate: ' New ',
      variables: ['x', 'x'],
      isActive: false,
    });
    expect(repository.updateTemplate).toHaveBeenCalledWith('template-1', {
      titleTemplate: 'New',
      variables: ['x'],
      isActive: false,
    });
  });

  it('enforces policy expiry and delivery bounds', async () => {
    const { service, repository } = createService();
    repository.upsertPolicy.mockResolvedValue({ uuid: 'policy-1' });
    await service.setPolicy('notification-1', {
      priority: 'HIGH',
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(
      service.setPolicy('notification-1', {
        expiresAt: new Date(Date.now() - 1),
      }),
    ).rejects.toThrow(BadRequestException);
    repository.getPolicy.mockResolvedValue(null);
    await expect(service.getPolicy('notification-1')).rejects.toThrow(
      NotFoundException,
    );
    repository.createDelivery.mockResolvedValue({ uuid: 'delivery-1' });
    await service.createDelivery('notification-1', 'EMAIL', 99);
    expect(repository.createDelivery).toHaveBeenCalledWith({
      notificationUuid: 'notification-1',
      channel: 'EMAIL',
      maxAttempts: 10,
    });
    expect(() => service.createDelivery('', 'EMAIL')).toThrow(
      BadRequestException,
    );
    expect(() => service.createDelivery('n', 'PUSH' as never)).toThrow(
      BadRequestException,
    );
  });

  it('delegates read operations', async () => {
    const { service, repository } = createService();
    await service.listPreferences('u');
    await service.listTemplates({ activeOnly: true });
    await service.listDeliveries('n');
    expect(repository.listPreferences).toHaveBeenCalledWith('u');
    expect(repository.listTemplates).toHaveBeenCalledWith({ activeOnly: true });
    expect(repository.listNotificationDeliveries).toHaveBeenCalledWith('n');
  });
});
