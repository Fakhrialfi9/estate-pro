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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('Sessions')
@ApiBearerAuth()
@Controller('auth/sessions')
@UseGuards(JwtAuthGuard)
@Throttle({ default: SECURITY_SESSION_RATE_LIMIT })
export class SessionController {
  constructor(private readonly sessions: SessionService) {}

  @Get()
  @ApiOperation({
    summary: 'List own sessions',
    description:
      'Lists non-sensitive session metadata owned by the authenticated user.',
  })
  async list(@Req() request: AuthenticatedRequest) {
    return { data: await this.sessions.listOwn(request.user.sub) };
  }

  @Post('logout-all')
  @ApiOperation({
    summary: 'Revoke all own sessions',
    description: 'Revokes all sessions owned by the authenticated user.',
  })
  async logoutAll(@Req() request: AuthenticatedRequest) {
    const revokedCount = await this.sessions.logoutAll(
      request.user.sub,
      requestContext(request),
    );
    return { success: true, revokedCount };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Revoke own session',
    description:
      'Revokes a session owned by the authenticated user using its public session identifier.',
  })
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

@ApiTags('Session Administration')
@ApiBearerAuth()
@Controller('admin/session-management')
@UseGuards(JwtAuthGuard, SessionAdminGuard)
@Throttle({ default: SECURITY_SESSION_RATE_LIMIT })
export class AdminSessionController {
  constructor(private readonly sessions: SessionService) {}

  @Post('users/:userUuid/sessions/:id/revoke')
  @ApiOperation({
    summary: 'Revoke another user session',
    description:
      'Privileged session administration; authorization is enforced by SessionAdminGuard.',
  })
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
