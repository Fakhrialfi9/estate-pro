import { Injectable } from '@nestjs/common';
import { AutomationService } from '../../../automation/application/services/automation.service.js';

@Injectable()
export class SystemJobOperationsService {
  constructor(private readonly automation: AutomationService) {}

  list(input: { page: number; limit: number; state?: string }, actorUuid: string) {
    return this.automation.listExecutions({ page: input.page, limit: input.limit, state: input.state }, actorUuid);
  }

  get(uuid: string, actorUuid: string) {
    return this.automation.getExecution(uuid, actorUuid);
  }

  retry(uuid: string, actorUuid: string) {
    return this.automation.retryExecution(uuid, actorUuid);
  }

  cancel(uuid: string, actorUuid: string) {
    return this.automation.cancelExecution(uuid, actorUuid);
  }
}
