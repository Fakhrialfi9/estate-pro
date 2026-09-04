import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AUTOMATION_NOTIFICATION_PORT,
  type AutomationNotificationPort,
} from '../../../../common/contracts/automation-system.port.js';
import type { SystemNotificationsContract } from '../../domain/system-public.contracts.js';
import { SYSTEM_ERROR_CODES } from '../../domain/system-error.codes.js';

@Injectable()
export class SystemNotificationService implements SystemNotificationsContract {
  constructor(
    @Inject(AUTOMATION_NOTIFICATION_PORT)
    private readonly automation: AutomationNotificationPort,
  ) {}

  async list(
    userUuid: string,
    page: number,
    limit: number,
    unreadOnly: boolean,
  ) {
    if (!userUuid) {
      throw new BadRequestException({
        code: 'AUTHENTICATED_ACTOR_MISSING',
        message: 'Authenticated actor missing.',
      });
    }
    return this.automation.listNotifications({
      page,
      limit,
      unreadOnly,
      userUuid,
    });
  }

  async markRead(userUuid: string, uuid: string) {
    if (!userUuid) {
      throw new BadRequestException({
        code: 'AUTHENTICATED_ACTOR_MISSING',
        message: 'Authenticated actor missing.',
      });
    }
    const result = await this.automation.markNotificationRead(uuid, userUuid);
    if (!result) {
      throw new NotFoundException({
        code: SYSTEM_ERROR_CODES.NOTIFICATION_NOT_FOUND,
        message: 'Notification not found.',
      });
    }
    return result;
  }
}
