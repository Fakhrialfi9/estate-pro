import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  TWO_FACTOR_ENROLLMENT_RATE_LIMIT,
  TWO_FACTOR_REAUTH_RATE_LIMIT,
  TWO_FACTOR_RECOVERY_REGENERATION_RATE_LIMIT,
  TWO_FACTOR_VERIFICATION_RATE_LIMIT,
} from '../../../config/rate-limit.config.js';
import { JwtAuthGuard } from '../security/jwt-auth.guard.js';
import type { AccessTokenClaims } from '../application/services/jwt-token.service.js';
import { LoginService } from '../application/services/login.service.js';
import { TwoFactorService } from '../application/services/two-factor.service.js';
import {
  DisableTwoFactorDto,
  RegenerateRecoveryCodesDto,
  TwoFactorVerifyDto,
  VerifyEnrollmentDto,
} from '../application/dto/two-factor.dto.js';

interface AuthenticatedRequest extends Request {
  user: AccessTokenClaims;
}

const requestContext = (request: Request) => ({
  ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
  ...(request.get('user-agent') !== undefined
    ? { userAgent: request.get('user-agent') }
    : {}),
  ...(request.get('x-request-id') !== undefined
    ? { requestId: request.get('x-request-id') }
    : {}),
});

@Controller('auth/2fa')
export class TwoFactorController {
  constructor(
    private readonly twoFactor: TwoFactorService,
    private readonly login: LoginService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  async status(@Req() request: AuthenticatedRequest) {
    return { enabled: await this.twoFactor.isEnabled(request.user.sub) };
  }

  @Post('enrollment')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: TWO_FACTOR_ENROLLMENT_RATE_LIMIT })
  async enrollment(@Req() request: AuthenticatedRequest) {
    return this.twoFactor.startEnrollment(
      request.user.sub,
      requestContext(request),
    );
  }

  @Post('enrollment/verify')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: TWO_FACTOR_ENROLLMENT_RATE_LIMIT })
  async verifyEnrollment(
    @Req() request: AuthenticatedRequest,
    @Body() dto: VerifyEnrollmentDto,
  ) {
    return this.twoFactor.verifyEnrollment(
      request.user.sub,
      dto.code,
      requestContext(request),
    );
  }

  @Post('verify')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: TWO_FACTOR_VERIFICATION_RATE_LIMIT })
  async verify(@Body() dto: TwoFactorVerifyDto, @Req() request: Request) {
    const result = await this.login.executeMfa({
      challengeToken: dto.challengeToken,
      ...(dto.code !== undefined ? { code: dto.code } : {}),
      ...(dto.recoveryCode !== undefined
        ? { recoveryCode: dto.recoveryCode }
        : {}),
      ...requestContext(request),
    });
    if (!result) throw new UnauthorizedException('Authentication failed');
    return result;
  }

  @Post('recovery-codes/regenerate')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: TWO_FACTOR_RECOVERY_REGENERATION_RATE_LIMIT })
  async regenerateRecoveryCodes(
    @Req() request: AuthenticatedRequest,
    @Body() dto: RegenerateRecoveryCodesDto,
  ) {
    return this.twoFactor.regenerateRecoveryCodes(
      request.user.sub,
      dto.password,
      dto.code,
      requestContext(request),
    );
  }

  @Post('disable')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: TWO_FACTOR_REAUTH_RATE_LIMIT })
  async disable(
    @Req() request: AuthenticatedRequest,
    @Body() dto: DisableTwoFactorDto,
  ) {
    await this.twoFactor.disable(
      request.user.sub,
      dto.password,
      dto.code,
      dto.recoveryCode,
      requestContext(request),
    );
    return { success: true };
  }
}
