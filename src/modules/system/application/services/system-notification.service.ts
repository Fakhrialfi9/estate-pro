import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AutomationService } from '../../../automation/application/services/automation.service.js';

@Injectable()
export class SystemNotificationService {
  constructor(private readonly automation: AutomationService) {}

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
