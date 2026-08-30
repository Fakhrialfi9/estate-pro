import { Body, Controller, Get, Headers, Header, HttpCode, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { LoginDto } from '../application/dto/login.dto.js';
import { RefreshTokenDto } from '../application/dto/refresh-token.dto.js';
import type { AccessTokenClaims } from '../application/services/jwt-token.service.js';
import { LoginService } from '../application/services/login.service.js';
import { LogoutService } from '../application/services/logout.service.js';
import { RefreshTokenService } from '../application/services/refresh-token.service.js';
import { JwtAuthGuard } from '../security/jwt-auth.guard.js';
import { LOGIN_RATE_LIMIT, REFRESH_RATE_LIMIT } from '../../../config/rate-limit.config.js';
import { UserManagementService, serializeUser } from '../../users/users.module.js';
import { RefreshTokenInvalidError, RefreshTokenExpiredError, RefreshTokenRevokedError, RefreshTokenReuseDetectedError } from '../domain/errors/refresh-token.errors.js';

interface AuthenticatedRequest extends Request { user: AccessTokenClaims; }
const requestContext = (request: Request) => ({ ipAddress: request.ip, userAgent: request.get('user-agent') ?? undefined, requestId: request.get('x-request-id') ?? undefined });

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly login: LoginService, private readonly logout: LogoutService, private readonly users: UserManagementService, private readonly refreshTokens: RefreshTokenService) {}

  @Post('login')
  @Throttle({ default: LOGIN_RATE_LIMIT })
  @ApiOperation({ summary: 'Authenticate a user', description: 'Validates credentials and, when enabled, returns an MFA challenge before issuing a session-bound access and refresh token.' })
  async loginUser(@Body() dto: LoginDto, @Req() request: Request) {
    const result = await this.login.execute({ ...dto, ...requestContext(request) });
    if (!result) throw new UnauthorizedException('Invalid credentials');
    return result;
  }

  @Post('refresh')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: REFRESH_RATE_LIMIT })
  @ApiOperation({ summary: 'Refresh an expired access token', description: 'Rotates the opaque refresh token and returns a new access token and refresh token.' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() request: Request, @Headers('cache-control') _cacheControl?: string) {
    void _cacheControl;
    try { return await this.refreshTokens.refresh(dto.refreshToken, requestContext(request)); }
    catch (error) {
      if (error instanceof RefreshTokenInvalidError || error instanceof RefreshTokenExpiredError || error instanceof RefreshTokenRevokedError || error instanceof RefreshTokenReuseDetectedError) throw new UnauthorizedException('Invalid refresh token');
      throw error;
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current session', description: 'Revokes the authenticated session and its refresh-token family.' })
  async logoutUser(@Req() request: AuthenticatedRequest) {
    await this.logout.execute({ userUuid: request.user.sub, sessionId: request.user.sid, ...requestContext(request) });
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user', description: 'Returns the authenticated user through the safe user serializer.' })
  async currentUser(@Req() request: AuthenticatedRequest) { return serializeUser(await this.users.getByUuid(request.user.sub)); }
}
