import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AutomationActor } from '../../../../common/contracts/automation-actor.js';
import {
  CRM_AUTOMATION_PORT,
  type AutomationCrmPort,
} from '../../../../common/contracts/automation-crm.port.js';
import {
  USER_PUBLIC_PORT,
  type UserPublicPort,
} from '../../../../common/contracts/user-public.port.js';
import { AUTOMATION_REPOSITORY } from '../../infrastructure/persistence/automation.repository.token.js';
import type {
  AutomationRepository,
  ActionHandler,
} from '../../domain/automation.ports.js';

const actor = (actorUuid: string): AutomationActor => ({
  actorUuid,
  permissions: ['crm.manage', 'sales.manage'],
});
const text = (value: unknown, field: string, max = 500): string => {
  if (typeof value !== 'string' || !value.trim())
    throw new BadRequestException(`${field} is required`);
  return value
    .normalize('NFKC')
    .replace(/[\p{Cc}]/gu, '')
    .trim()
    .slice(0, max);
};
const uuid = (value: unknown, field: string): string => {
  const result = text(value, field, 80);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      result,
    )
  )
    throw new BadRequestException(`Invalid ${field}`);
  return result;
};

@Injectable()
export class AssignLeadAction implements ActionHandler {
  readonly actionType = 'ASSIGN_LEAD';
  constructor(
    @Inject(CRM_AUTOMATION_PORT) private readonly crm: AutomationCrmPort,
    @Inject(USER_PUBLIC_PORT) private readonly users: UserPublicPort,
  ) {}
  async execute(
    input: Record<string, unknown>,
    context: Record<string, unknown>,
    actorUuid: string,
  ) {
    const leadUuid = uuid(input.leadUuid ?? context.uuid, 'leadUuid');
    const userUuid = uuid(input.userUuid, 'userUuid');
    const user = await this.users.getUser(userUuid);
    if (!user.isActive || user.deletedAt)
      return {
        success: false,
        retryable: false,
        errorCode: 'ASSIGNEE_INACTIVE',
        errorMessage: 'Assignee is not active',
      };
    const result = await this.crm.assignLead(
      leadUuid,
      userUuid,
      actor(actorUuid),
    );
    return {
      success: true,
      retryable: false,
      reference: String(result.uuid ?? leadUuid),
      output: { leadUuid, userUuid },
    };
  }
}

@Injectable()
export class RefreshLeadScoreAction implements ActionHandler {
  readonly actionType = 'REFRESH_LEAD_SCORE';
  constructor(
    @Inject(CRM_AUTOMATION_PORT) private readonly crm: AutomationCrmPort,
  ) {}
  async execute(
    input: Record<string, unknown>,
    context: Record<string, unknown>,
    actorUuid: string,
  ) {
    const leadUuid = uuid(input.leadUuid ?? context.uuid, 'leadUuid');
    const result = await this.crm.refreshLeadScore(leadUuid, actor(actorUuid));
    return {
      success: true,
      retryable: false,
      reference: String(result.uuid ?? leadUuid),
      output: { score: result.score ?? null },
    };
  }
}

@Injectable()
export class CreateActivityAction implements ActionHandler {
  readonly actionType = 'CREATE_ACTIVITY';
  constructor(
    @Inject(CRM_AUTOMATION_PORT) private readonly crm: AutomationCrmPort,
  ) {}
  async execute(
    input: Record<string, unknown>,
    context: Record<string, unknown>,
    actorUuid: string,
  ) {
    const leadUuid = input.leadUuid
      ? uuid(input.leadUuid, 'leadUuid')
      : typeof context.uuid === 'string'
        ? context.uuid
        : undefined;
    const result = await this.crm.createActivity(
      {
        leadUuid,
        contactUuid:
          typeof input.contactUuid === 'string' ? input.contactUuid : undefined,
        type: text(input.type ?? 'TASK', 'type', 40),
        subject: text(input.subject ?? 'Automation follow-up', 'subject', 180),
        description: input.description
          ? text(input.description, 'description', 5000)
          : undefined,
        dueAt: input.dueAt
          ? new Date(String(input.dueAt)).toISOString()
          : undefined,
        reminderAt: input.reminderAt
          ? new Date(String(input.reminderAt)).toISOString()
          : undefined,
        assigneeUserUuid: input.assigneeUserUuid
          ? uuid(input.assigneeUserUuid, 'assigneeUserUuid')
          : null,
      },
      actor(actorUuid),
    );
    return {
      success: true,
      retryable: false,
      reference: String(result.uuid),
      output: { activityUuid: result.uuid },
    };
  }
}

@Injectable()
export class EnqueueCommunicationAction implements ActionHandler {
  readonly actionType = 'ENQUEUE_COMMUNICATION';
  constructor(
    @Inject(CRM_AUTOMATION_PORT) private readonly crm: AutomationCrmPort,
  ) {}
  async execute(
    input: Record<string, unknown>,
    context: Record<string, unknown>,
    actorUuid: string,
  ) {
    const channel = text(input.channel, 'channel', 30).toUpperCase();
    if (!['EMAIL', 'SMS', 'WHATSAPP'].includes(channel))
      return {
        success: false,
        retryable: false,
        errorCode: 'CHANNEL_NOT_ALLOWED',
        errorMessage: 'Unsupported communication channel',
      };
    const body = text(input.body, 'body', 10000);
    if (/<|>|javascript\s*:/i.test(body))
      return {
        success: false,
        retryable: false,
        errorCode: 'UNSAFE_CONTENT',
        errorMessage: 'Unsafe communication content',
      };
    const result = await this.crm.enqueueCommunication(
      {
        channel,
        templateUuid: input.templateUuid
          ? uuid(input.templateUuid, 'templateUuid')
          : undefined,
        recipient: input.recipient
          ? text(input.recipient, 'recipient', 320)
          : undefined,
        subject: input.subject
          ? text(input.subject, 'subject', 180)
          : undefined,
        body,
        contactUuid:
          typeof context.contactUuid === 'string'
            ? context.contactUuid
            : undefined,
        leadUuid: typeof context.uuid === 'string' ? context.uuid : undefined,
      },
      actor(actorUuid),
    );
    return {
      success: true,
      retryable: false,
      reference: String(result.uuid),
      output: { communicationUuid: result.uuid },
    };
  }
}

@Injectable()
export class NotifyAction implements ActionHandler {
  readonly actionType = 'NOTIFY';
  constructor(
    @Inject(AUTOMATION_REPOSITORY) private readonly repo: AutomationRepository,
    @Inject(USER_PUBLIC_PORT) private readonly users: UserPublicPort,
  ) {}
  async execute(
    input: Record<string, unknown>,
    context: Record<string, unknown>,
  ) {
    const userUuid = uuid(input.userUuid, 'userUuid');
    const user = await this.users.getUser(userUuid);
    if (!user.isActive || user.deletedAt)
      return {
        success: false,
        retryable: false,
        errorCode: 'NOTIFICATION_TARGET_INACTIVE',
        errorMessage: 'Notification target is inactive',
      };
    const title = text(input.title, 'title', 180);
    const body = text(input.body, 'body', 5000);
    if (/[<>]/.test(body))
      return {
        success: false,
        retryable: false,
        errorCode: 'UNSAFE_NOTIFICATION',
        errorMessage: 'Unsafe notification content',
      };
    const result = await this.repo.createNotification({
      uuid: randomUUID(),
      userUuid,
      type: text(input.type ?? 'AUTOMATION', 'type', 50),
      title,
      body,
      entityType:
        typeof context.entityType === 'string' ? context.entityType : null,
      entityUuid: typeof context.uuid === 'string' ? context.uuid : null,
      status: 'UNREAD',
    });
    return {
      success: true,
      retryable: false,
      reference: String(result.uuid),
      output: { notificationUuid: result.uuid },
    };
  }
}

@Injectable()
export class EscalateAction implements ActionHandler {
  readonly actionType = 'ESCALATE';
  constructor(
    @Inject(CRM_AUTOMATION_PORT) private readonly crm: AutomationCrmPort,
    @Inject(USER_PUBLIC_PORT) private readonly users: UserPublicPort,
  ) {}
  async execute(
    input: Record<string, unknown>,
    context: Record<string, unknown>,
    actorUuid: string,
  ) {
    const target = uuid(input.userUuid, 'userUuid');
    const user = await this.users.getUser(target);
    if (!user.isActive || user.deletedAt)
      return {
        success: false,
        retryable: false,
        errorCode: 'ESCALATION_TARGET_INACTIVE',
        errorMessage: 'Escalation target is inactive',
      };
    if (typeof context.uuid !== 'string')
      return {
        success: false,
        retryable: false,
        errorCode: 'ESCALATION_TARGET_MISSING',
        errorMessage: 'Entity target is missing',
      };
    const leadUuid =
      context.entityType !== 'LEAD' && typeof context.leadUuid === 'string'
        ? context.leadUuid
        : context.uuid;
    const assignment = await this.crm.assignLead(
      leadUuid,
      target,
      actor(actorUuid),
    );
    if (input.activitySubject)
      await this.crm.createActivity(
        {
          leadUuid,
          type: 'TASK',
          subject: text(input.activitySubject, 'activitySubject', 180),
          description: input.activityDescription
            ? text(input.activityDescription, 'activityDescription', 5000)
            : undefined,
        },
        actor(actorUuid),
      );
    return {
      success: true,
      retryable: false,
      reference: String(assignment.uuid ?? leadUuid),
      output: { escalatedTo: target, leadUuid },
    };
  }
}

@Injectable()
export class RequestStatusTransitionAction implements ActionHandler {
  readonly actionType = 'REQUEST_STATUS_TRANSITION';
  constructor(
    @Inject(CRM_AUTOMATION_PORT) private readonly crm: AutomationCrmPort,
  ) {}
  async execute(
    input: Record<string, unknown>,
    context: Record<string, unknown>,
    actorUuid: string,
  ) {
    const leadUuid = uuid(input.leadUuid ?? context.uuid, 'leadUuid');
    const statusUuid = uuid(input.statusUuid, 'statusUuid');
    const result = await this.crm.changeLeadStatus(
      leadUuid,
      statusUuid,
      actor(actorUuid),
    );
    return {
      success: true,
      retryable: false,
      reference: String(result.uuid ?? leadUuid),
      output: { leadUuid, statusUuid },
    };
  }
}

export const AUTOMATION_ACTION_PROVIDERS = [
  AssignLeadAction,
  RefreshLeadScoreAction,
  CreateActivityAction,
  EnqueueCommunicationAction,
  NotifyAction,
  EscalateAction,
  RequestStatusTransitionAction,
] as const;
