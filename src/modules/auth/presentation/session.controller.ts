import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AccessTokenClaims } from '../application/services/jwt-token.service.js';
import { SessionService } from '../application/services/session.service.js';
import { JwtAuthGuard } from '../security/jwt-auth.guard.js';
import { SessionAdminGuard } from '../security/session-admin.guard.js';
import { SECURITY_SESSION_RATE_LIMIT } from '../../../config/rate-limit.config.js';

interface AuthenticatedRequest extends Request {
  user: AccessTokenClaims;
}

const requestContext = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.get('user-agent') ?? undefined,
  requestId: request.get('x-request-id') ?? undefined,
});

@Controller('auth/sessions')
@UseGuards(JwtAuthGuard)
@Throttle({ default: SECURITY_SESSION_RATE_LIMIT })
export class SessionController {
  constructor(private readonly sessions: SessionService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return { data: await this.sessions.listOwn(request.user.sub) };
  }

  @Post('logout-all')
  async logoutAll(@Req() request: AuthenticatedRequest) {
    const revokedCount = await this.sessions.logoutAll(
      request.user.sub,
      requestContext(request),
    );
    return { success: true, revokedCount };
  }

  @Delete(':id')
  async revoke(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    this.assertPublicSessionId(id);
    await this.sessions.revokeOwnSession(
      request.user.sub,
      id,
      requestContext(request),
    );
    return { success: true };
  }

  private assertPublicSessionId(id: string): void {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('Invalid session identifier');
    }
  }
}

@Controller('admin/session-management')
@UseGuards(JwtAuthGuard, SessionAdminGuard)
@Throttle({ default: SECURITY_SESSION_RATE_LIMIT })
export class AdminSessionController {
  constructor(private readonly sessions: SessionService) {}

  @Post('users/:userUuid/sessions/:id/revoke')
  async revoke(
    @Req() request: AuthenticatedRequest,
    @Param('userUuid') userUuid: string,
    @Param('id') id: string,
  ) {
    if (!/^[0-9a-f-]{36}$/i.test(userUuid) || !/^\d+$/.test(id)) {
      throw new BadRequestException('Invalid session target');
    }
    await this.sessions.adminRevoke(
      request.user.sub,
      userUuid,
      id,
      requestContext(request),
    );
    return { success: true };
  }
}
