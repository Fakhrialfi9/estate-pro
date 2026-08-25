import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { LoginDto } from '../application/dto/login.dto.js';
import type { AccessTokenClaims } from '../application/services/jwt-token.service.js';
import { LoginService } from '../application/services/login.service.js';
import { LogoutService } from '../application/services/logout.service.js';
import { JwtAuthGuard } from '../security/jwt-auth.guard.js';
import { LOGIN_RATE_LIMIT } from '../../../config/rate-limit.config.js';

interface AuthenticatedRequest extends Request {
  user: AccessTokenClaims;
}

const requestContext = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.get('user-agent') ?? undefined,
  requestId: request.get('x-request-id') ?? undefined,
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginService,
    private readonly logout: LogoutService,
  ) {}

  @Post('login')
  @Throttle({ default: LOGIN_RATE_LIMIT })
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
  async logoutUser(@Req() request: AuthenticatedRequest) {
    await this.logout.execute({
      userUuid: request.user.sub,
      sessionId: request.user.sid,
      ...requestContext(request),
    });
    return { success: true };
  }
}
