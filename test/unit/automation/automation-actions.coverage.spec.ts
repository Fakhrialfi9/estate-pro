import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  AssignLeadAction,
  RefreshLeadScoreAction,
  CreateActivityAction,
  EnqueueCommunicationAction,
  NotifyAction,
  EscalateAction,
  RequestStatusTransitionAction,
} from '../../../src/modules/automation/application/actions/automation-actions.js';

const leadUuid = '11111111-1111-4111-8111-111111111111';
const userUuid = '22222222-2222-4222-8222-222222222222';
const statusUuid = '33333333-3333-4333-8333-333333333333';
const templateUuid = '44444444-4444-4444-8444-444444444444';

const activeUser = { isActive: true, deletedAt: null };

const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('automation-actions coverage', () => {
  it('AssignLeadAction covers context fallback, inactive assignee, and successful assignment', async () => {
    const crm = { assignLead: vi.fn().mockResolvedValue({ uuid: undefined }) };
    const users = { getUser: vi.fn().mockResolvedValue(activeUser) };
    const action = new AssignLeadAction(crm as never, users as never);

    const success = await action.execute(
      { userUuid },
      { uuid: leadUuid },
      actor,
    );
    expect(success).toEqual({
      success: true,
      retryable: false,
      reference: leadUuid,
      output: { leadUuid, userUuid },
    });

    users.getUser.mockResolvedValueOnce({ isActive: false, deletedAt: null });
    await expect(action.execute({ leadUuid, userUuid }, {}, actor)).resolves.toEqual({
      success: false,
      retryable: false,
      errorCode: 'ASSIGNEE_INACTIVE',
      errorMessage: 'Assignee is not active',
    });

    users.getUser.mockResolvedValueOnce({ isActive: true, deletedAt: new Date() });
    await expect(action.execute({ leadUuid, userUuid }, {}, actor)).resolves.toMatchObject({
      success: false,
      errorCode: 'ASSIGNEE_INACTIVE',
    });
  });

  it('validates AssignLeadAction identifiers and propagates dependency errors', async () => {
    const action = new AssignLeadAction(
      { assignLead: vi.fn() } as never,
      { getUser: vi.fn() } as never,
    );
    await expect(action.execute({}, {}, actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(action.execute({ leadUuid: 'bad', userUuid }, {}, actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(action.execute({ leadUuid, userUuid: 'bad' }, {}, actor)).rejects.toBeInstanceOf(BadRequestException);

    const error = new Error('lookup failed');
    const users = { getUser: vi.fn().mockRejectedValue(error) };
    const actionWithFailure = new AssignLeadAction({ assignLead: vi.fn() } as never, users as never);
    await expect(actionWithFailure.execute({ leadUuid, userUuid }, {}, actor)).rejects.toBe(error);
  });

  it('RefreshLeadScoreAction covers fallback reference, score nullability, and validation', async () => {
    const crm = { refreshLeadScore: vi.fn().mockResolvedValue({ uuid: undefined, score: undefined }) };
    const action = new RefreshLeadScoreAction(crm as never);

    await expect(action.execute({}, { uuid: leadUuid }, actor)).resolves.toEqual({
      success: true,
      retryable: false,
      reference: leadUuid,
      output: { score: null },
    });

    crm.refreshLeadScore.mockResolvedValueOnce({ uuid: 'result', score: 91 });
    await expect(action.execute({ leadUuid }, {}, actor)).resolves.toEqual({
      success: true,
      retryable: false,
      reference: 'result',
      output: { score: 91 },
    });

    await expect(action.execute({ leadUuid: 'bad' }, {}, actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('CreateActivityAction covers defaults, optional fields, dates, and errors', async () => {
    const crm = { createActivity: vi.fn().mockResolvedValue({ uuid: 'activity-1' }) };
    const action = new CreateActivityAction(crm as never);

    await expect(action.execute({}, { uuid: leadUuid }, actor)).resolves.toMatchObject({
      success: true,
      reference: 'activity-1',
      output: { activityUuid: 'activity-1' },
    });
    expect(crm.createActivity).toHaveBeenLastCalledWith(
      expect.objectContaining({
        leadUuid,
        type: 'TASK',
        subject: 'Automation follow-up',
        contactUuid: undefined,
        description: undefined,
        dueAt: undefined,
        reminderAt: undefined,
        assigneeUserUuid: null,
      }),
      expect.objectContaining({ actorUuid: actor }),
    );

    await action.execute(
      {
        leadUuid,
        contactUuid: 'contact-1',
        type: 'CALL',
        subject: 'Follow up',
        description: 'Details',
        dueAt: '2026-01-01T00:00:00Z',
        reminderAt: 1767225600000,
        assigneeUserUuid: userUuid,
      },
      {},
      actor,
    );
    expect(crm.createActivity).toHaveBeenLastCalledWith(
      expect.objectContaining({
        leadUuid,
        contactUuid: 'contact-1',
        type: 'CALL',
        subject: 'Follow up',
        description: 'Details',
        dueAt: '2026-01-01T00:00:00.000Z',
        assigneeUserUuid: userUuid,
      }),
      expect.anything(),
    );

    await expect(action.execute({}, {}, actor)).resolves.toMatchObject({
      success: true,
      reference: 'activity-1',
    });
    await expect(action.execute({ description: '   ' }, { uuid: leadUuid }, actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(action.execute({ dueAt: {} }, { uuid: leadUuid }, actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(action.execute({ dueAt: 'invalid' }, { uuid: leadUuid }, actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(action.execute({ assigneeUserUuid: 'bad' }, { uuid: leadUuid }, actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('EnqueueCommunicationAction covers channels, content safety, optional fields, and UUID validation', async () => {
    const crm = { enqueueCommunication: vi.fn().mockResolvedValue({ uuid: undefined }) };
    const action = new EnqueueCommunicationAction(crm as never);

    await expect(action.execute({ channel: ' email ', body: 'Hello' }, { uuid: leadUuid }, actor)).resolves.toEqual({
      success: true,
      retryable: false,
      reference: '',
      output: { communicationUuid: undefined },
    });
    expect(crm.enqueueCommunication).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'EMAIL',
        body: 'Hello',
        leadUuid,
      }),
      expect.objectContaining({ actorUuid: actor }),
    );

    await expect(action.execute({ channel: 'push', body: 'Hello' }, {}, actor)).resolves.toMatchObject({
      success: false,
      errorCode: 'CHANNEL_NOT_ALLOWED',
    });
    await expect(action.execute({ channel: 'EMAIL', body: '<script>' }, {}, actor)).resolves.toMatchObject({
      success: false,
      errorCode: 'UNSAFE_CONTENT',
    });
    await expect(action.execute({ channel: 'SMS' }, {}, actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(action.execute({ channel: 'WHATSAPP', body: 'Hi', templateUuid: 'bad' }, {}, actor)).rejects.toBeInstanceOf(BadRequestException);

    crm.enqueueCommunication.mockResolvedValueOnce({ uuid: 'comm-1' });
    await expect(action.execute(
      {
        channel: 'whatsapp',
        body: 'Hi',
        templateUuid,
        recipient: 'recipient',
        subject: 'Subject',
      },
      { contactUuid: 'contact-1', uuid: leadUuid },
      actor,
    )).resolves.toMatchObject({ reference: 'comm-1', output: { communicationUuid: 'comm-1' } });
  });

  it('NotifyAction covers inactive users, unsafe body, defaults, and successful persistence', async () => {
    const repo = { createNotification: vi.fn().mockResolvedValue({ uuid: 'notification-1' }) };
    const users = { getUser: vi.fn().mockResolvedValue(activeUser) };
    const action = new NotifyAction(repo as never, users as never);

    await expect(action.execute({ userUuid, title: 'Title', body: 'Body' }, { uuid: leadUuid, entityType: 'LEAD' })).resolves.toMatchObject({
      success: true,
      reference: 'notification-1',
      output: { notificationUuid: 'notification-1' },
    });
    expect(repo.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userUuid,
      type: 'AUTOMATION',
      title: 'Title',
      body: 'Body',
      entityType: 'LEAD',
      entityUuid: leadUuid,
      status: 'UNREAD',
    }));

    users.getUser.mockResolvedValueOnce({ isActive: false, deletedAt: null });
    await expect(action.execute({ userUuid, title: 'Title', body: 'Body' }, {})).resolves.toMatchObject({ errorCode: 'NOTIFICATION_TARGET_INACTIVE' });
    await expect(action.execute({ userUuid, title: 'Title', body: '<Body>' }, {})).resolves.toMatchObject({ errorCode: 'UNSAFE_NOTIFICATION' });
    await expect(action.execute({ userUuid, body: 'Body' }, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(action.execute({ userUuid: 'bad', title: 'Title', body: 'Body' }, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('EscalateAction covers target/context branches and optional activity creation', async () => {
    const crm = {
      assignLead: vi.fn().mockResolvedValue({ uuid: 'assignment-1' }),
      createActivity: vi.fn().mockResolvedValue({ uuid: 'activity-1' }),
    };
    const users = { getUser: vi.fn().mockResolvedValue(activeUser) };
    const action = new EscalateAction(crm as never, users as never);

    await expect(action.execute({ userUuid }, { uuid: leadUuid, entityType: 'LEAD' }, actor)).resolves.toMatchObject({
      success: true,
      reference: 'assignment-1',
      output: { escalatedTo: userUuid, leadUuid },
    });
    expect(crm.createActivity).not.toHaveBeenCalled();

    await expect(action.execute({ userUuid, activitySubject: 'Escalate now', activityDescription: 'Urgent' }, { uuid: 'entity-1', entityType: 'CASE', leadUuid }, actor)).resolves.toMatchObject({
      success: true,
      output: { leadUuid },
    });
    expect(crm.createActivity).toHaveBeenCalledWith(
      expect.objectContaining({ leadUuid, subject: 'Escalate now', description: 'Urgent' }),
      expect.objectContaining({ actorUuid: actor }),
    );

    users.getUser.mockResolvedValueOnce({ isActive: false, deletedAt: null });
    await expect(action.execute({ userUuid }, { uuid: leadUuid }, actor)).resolves.toMatchObject({ errorCode: 'ESCALATION_TARGET_INACTIVE' });
    users.getUser.mockResolvedValueOnce(activeUser);
    await expect(action.execute({ userUuid }, {}, actor)).resolves.toMatchObject({ errorCode: 'ESCALATION_TARGET_MISSING' });
    await expect(action.execute({ userUuid: 'bad' }, { uuid: leadUuid }, actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(action.execute({ userUuid, activitySubject: '<invalid>' }, { uuid: leadUuid }, actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('RequestStatusTransitionAction covers context fallback and validation', async () => {
    const crm = { changeLeadStatus: vi.fn().mockResolvedValue({ uuid: undefined }) };
    const action = new RequestStatusTransitionAction(crm as never);

    await expect(action.execute({ statusUuid }, { uuid: leadUuid }, actor)).resolves.toEqual({
      success: true,
      retryable: false,
      reference: leadUuid,
      output: { leadUuid, statusUuid },
    });
    await expect(action.execute({ leadUuid, statusUuid }, {}, actor)).resolves.toMatchObject({ reference: leadUuid });
    await expect(action.execute({ statusUuid }, {}, actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(action.execute({ leadUuid, statusUuid: 'bad' }, {}, actor)).rejects.toBeInstanceOf(BadRequestException);
  });
});
