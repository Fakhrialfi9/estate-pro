import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  CRM_AUTOMATION_PORT,
  type AutomationCrmPort,
} from '../../../../common/contracts/automation-crm.port.js';
import type { AutomationActor } from '../../../../common/contracts/automation-actor.js';
import type { ActionHandler } from '../../domain/automation.ports.js';

interface RetryableError {
  readonly retryable?: unknown;
}

function hasRetryClassification(error: unknown): error is RetryableError {
  return error !== null && typeof error === 'object' && 'retryable' in error;
}

@Injectable()
export class SendCommunicationAction implements ActionHandler {
  readonly actionType = 'SEND_COMMUNICATION';

  constructor(
    @Inject(CRM_AUTOMATION_PORT)
    private readonly crm: AutomationCrmPort,
  ) {}

  async execute(
    input: Record<string, unknown>,
    context: Record<string, unknown>,
    actorUuid: string,
  ) {
    const value = input.communicationUuid ?? context.communicationUuid;
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException('communicationUuid is required');
    }

    const actor: AutomationActor = {
      actorUuid,
      permissions: ['crm.manage'],
    };

    try {
      const result = await this.crm.deliverCommunication(value, actor);
      const reference = typeof result.uuid === 'string' ? result.uuid : value;
      return {
        success: true,
        retryable: false,
        reference,
        output: result,
      };
    } catch (error: unknown) {
      const retryable = hasRetryClassification(error)
        ? error.retryable === true
        : false;
      return {
        success: false,
        retryable,
        errorCode: 'COMMUNICATION_DELIVERY_FAILED',
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 240)
            : 'Communication delivery failed',
      };
    }
  }
}
