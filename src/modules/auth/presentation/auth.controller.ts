import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { LoginDto } from '../application/dto/login.dto.js';
import type { AccessTokenClaims } from '../application/services/jwt-token.service.js';
import { LoginService } from '../application/services/login.service.js';
import { LogoutService } from '../application/services/logout.service.js';
import { JwtAuthGuard } from '../security/jwt-auth.guard.js';
import { LOGIN_RATE_LIMIT } from '../../../config/rate-limit.config.js';
import { UserManagementService } from '../../users/application/services/user-management.service.js';
import { serializeUser } from '../../users/application/serializers/user.serializer.js';

interface AuthenticatedRequest extends Request {
  user: AccessTokenClaims;
}

const requestContext = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.get('user-agent') ?? undefined,
  requestId: request.get('x-request-id') ?? undefined,
});

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginService,
    private readonly logout: LogoutService,
    private readonly users: UserManagementService,
  ) {}

  @Post('login')
  @Throttle({ default: LOGIN_RATE_LIMIT })
  @ApiOperation({
    summary: 'Authenticate a user',
    description:
      'Validates credentials and, when enabled, returns an MFA challenge before issuing a session-bound access token.',
  })
  async loginUser(@Body() dto: LoginDto, @Req() request: Request) {
    const result = await this.login.execute({
      ...dto,
      ...requestContext(request),
    });

    if (!result) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return result;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout current session',
    description: 'Revokes the authenticated session represented by the access token.',
  })
  async logoutUser(@Req() request: AuthenticatedRequest) {
    await this.logout.execute({
      userUuid: request.user.sub,
      sessionId: request.user.sid,
      ...requestContext(request),
    });
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user',
    description:
      'Returns the authenticated user through the safe user serializer; credentials, session secrets and MFA secrets are excluded.',
  })
  async currentUser(@Req() request: AuthenticatedRequest) {
    return serializeUser(await this.users.getByUuid(request.user.sub));
  }
}
