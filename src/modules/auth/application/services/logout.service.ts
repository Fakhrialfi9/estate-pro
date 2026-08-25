import { Injectable } from '@nestjs/common';
import { SessionService } from './session.service.js';

export interface LogoutCommand {
  userUuid: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class LogoutService {
  constructor(private readonly sessions: SessionService) {}

  async execute(command: LogoutCommand): Promise<void> {
    await this.sessions.logoutCurrent(command.userUuid, command.sessionId, {
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
      requestId: command.requestId,
    });
  }
}
