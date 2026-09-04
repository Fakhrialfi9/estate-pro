import { Inject, Injectable } from '@nestjs/common';
import {
  AUTOMATION_SYSTEM_PORT,
  type AutomationSystemPort,
} from '../../../../common/contracts/automation-system.port.js';
import type { SystemJobsContract } from '../../domain/system-public.contracts.js';

@Injectable()
export class SystemJobOperationsService implements SystemJobsContract {
  constructor(
    @Inject(AUTOMATION_SYSTEM_PORT)
    private readonly automation: AutomationSystemPort,
  ) {}

  list(
    input: { page: number; limit: number; state?: string },
    actorUuid: string,
  ) {
    return this.automation.listExecutions(
      { page: input.page, limit: input.limit, state: input.state },
      actorUuid,
    );
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
