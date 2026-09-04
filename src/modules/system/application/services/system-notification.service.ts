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
    if (!userUuid) throw new BadRequestException('Authenticated actor missing');
    return this.automation.listNotifications({
      page,
      limit,
      unreadOnly,
      userUuid,
    });
  }

  async markRead(userUuid: string, uuid: string) {
    if (!userUuid) throw new BadRequestException('Authenticated actor missing');
    const result = await this.automation.markNotificationRead(uuid, userUuid);
    if (!result) throw new NotFoundException('Notification not found');
    return result;
  }
}
