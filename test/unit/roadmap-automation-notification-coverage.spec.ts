import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { SendCommunicationAction } from '../../src/modules/automation/application/actions/send-communication.action.js';
import { AutomationNotificationService } from '../../src/modules/automation/application/services/automation-notification.service.js';

const userUuid = '123e4567-e89b-12d3-a456-426614174000';

describe('automation notification and communication coverage', () => {
  it('covers send communication input, success and failure classification', async () => {
    const crm = { deliverCommunication: vi.fn() };
    const action = new SendCommunicationAction(crm as never);

    await expect(action.execute({}, {}, userUuid)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      action.execute({ communicationUuid: '  ' }, {}, userUuid),
    ).rejects.toBeInstanceOf(BadRequestException);

    crm.deliverCommunication.mockResolvedValueOnce({
      uuid: 'communication-1',
      delivered: true,
    });
    await expect(
      action.execute({ communicationUuid: 'communication-1' }, {}, userUuid),
    ).resolves.toMatchObject({
      success: true,
      retryable: false,
      reference: 'communication-1',
    });

    crm.deliverCommunication.mockResolvedValueOnce({ delivered: true });
    await expect(
      action.execute({}, { communicationUuid: 'context-1' }, userUuid),
    ).resolves.toMatchObject({
      success: true,
      reference: 'context-1',
    });

    crm.deliverCommunication.mockRejectedValueOnce(
      Object.assign(new Error('temporary provider failure'), {
        retryable: true,
      }),
    );
    await expect(
      action.execute({ communicationUuid: 'communication-2' }, {}, userUuid),
    ).resolves.toMatchObject({
      success: false,
      retryable: true,
      errorCode: 'COMMUNICATION_DELIVERY_FAILED',
      errorMessage: 'temporary provider failure',
    });

    crm.deliverCommunication.mockRejectedValueOnce(new Error('permanent failure'));
    await expect(
      action.execute({ communicationUuid: 'communication-3' }, {}, userUuid),
    ).resolves.toMatchObject({
      success: false,
      retryable: false,
      errorMessage: 'permanent failure',
    });

    crm.deliverCommunication.mockRejectedValueOnce({ retryable: true });
    await expect(
      action.execute({ communicationUuid: 'communication-4' }, {}, userUuid),
    ).resolves.toMatchObject({
      success: false,
      retryable: true,
      errorMessage: 'Communication delivery failed',
    });
  });

  it('covers notification CRUD validation and policy branches', async () => {
    const repository = {
      createNotification: vi.fn().mockResolvedValue({ uuid: 'notification-1' }),
      listPreferences: vi.fn().mockResolvedValue([]),
      upsertPreference: vi.fn().mockResolvedValue({ enabled: true }),
      listTemplates: vi.fn().mockResolvedValue([]),
      createTemplate: vi.fn().mockResolvedValue({ uuid: 'template-1' }),
      updateTemplate: vi.fn().mockResolvedValue({ uuid: 'template-1' }),
      upsertPolicy: vi.fn().mockResolvedValue({
        notificationUuid: 'notification-1',
      }),
      getPolicy: vi.fn().mockResolvedValue({ notificationUuid: 'notification-1' }),
      createDelivery: vi.fn().mockResolvedValue({
        notificationUuid: 'notification-1',
      }),
      listNotificationDeliveries: vi.fn().mockResolvedValue([]),
    };
    const service = new AutomationNotificationService(repository as never);

    expect(() => service.createNotification({})).toThrow(BadRequestException);
    expect(() =>
      service.createNotification({
        userUuid,
        type: 'bad type',
        title: 't',
        body: 'b',
      }),
    ).toThrow('Invalid notification type');
    expect(() =>
      service.createNotification({
        userUuid,
        type: 'TYPE',
        title: 't',
        body: 'b',
        priority: 'INVALID',
      }),
    ).toThrow('Invalid notification priority');
    await expect(
      service.createNotification({
        userUuid,
        type: 'TYPE',
        title: ' Title ',
        body: ' Body ',
        metadata: ['invalid'],
      }),
    ).resolves.toEqual({ uuid: 'notification-1' });
    expect(repository.createNotification).toHaveBeenCalled();

    await expect(service.listPreferences(userUuid)).resolves.toEqual([]);
    await expect(
      service.setPreference('', {
        notificationType: 'A',
        channel: 'EMAIL',
        enabled: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.setPreference(userUuid, {
        notificationType: 'bad type',
        channel: 'EMAIL',
        enabled: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.setPreference(userUuid, {
        notificationType: 'lead.created',
        channel: 'EMAIL',
        enabled: true,
      }),
    ).resolves.toEqual({ enabled: true });
    await expect(service.listTemplates()).resolves.toEqual([]);
    await expect(
      service.createTemplate({
        code: 'template-1',
        version: 1,
        titleTemplate: 'Title',
        bodyTemplate: 'Body',
        variables: ['name', 'name'],
        actorUuid: userUuid,
      }),
    ).resolves.toEqual({ uuid: 'template-1' });
    await expect(
      service.createTemplate({
        code: 'bad code',
        version: 1,
        titleTemplate: 'Title',
        bodyTemplate: 'Body',
        variables: [],
        actorUuid: userUuid,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createTemplate({
        code: 'template-2',
        version: 0,
        titleTemplate: 'Title',
        bodyTemplate: 'Body',
        variables: [],
        actorUuid: userUuid,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateTemplate('', { titleTemplate: 'Title' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateTemplate('template-1', {
        titleTemplate: 'Title',
        bodyTemplate: 'Body',
        variables: ['name', 'name'],
        isActive: false,
      }),
    ).resolves.toEqual({ uuid: 'template-1' });
    await expect(service.setPolicy('', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.setPolicy('notification-1', { priority: 'INVALID' as never }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.setPolicy('notification-1', {
        expiresAt: new Date(Date.now() - 1000),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.setPolicy('notification-1', {})).resolves.toEqual({
      notificationUuid: 'notification-1',
    });
    repository.getPolicy.mockResolvedValueOnce(null);
    await expect(service.getPolicy('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(() => service.createDelivery('', 'EMAIL')).toThrow(BadRequestException);
    expect(() =>
      service.createDelivery('notification-1', 'INVALID' as never),
    ).toThrow(BadRequestException);
    await expect(
      service.createDelivery('notification-1', 'EMAIL', 99),
    ).resolves.toEqual({ notificationUuid: 'notification-1' });
    await expect(service.listDeliveries('notification-1')).resolves.toEqual([]);
  });
});
