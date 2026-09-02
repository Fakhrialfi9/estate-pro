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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
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

@ApiTags('2FA')
@ApiBearerAuth()
@Controller('auth/2fa')
export class TwoFactorController {
  constructor(
    private readonly twoFactor: TwoFactorService,
    private readonly login: LoginService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get 2FA status',
    description: 'Authenticated endpoint. Only enabled state is returned.',
  })
  async status(@Req() request: AuthenticatedRequest) {
    return { enabled: await this.twoFactor.isEnabled(request.user.sub) };
  }

  @Post('enrollment')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Start 2FA enrollment',
    description:
      'Authenticated enrollment. Provisioning material is never logged and the secret is protected by the application service.',
  })
  async enrollment(@Req() request: AuthenticatedRequest) {
    return this.twoFactor.startEnrollment(
      request.user.sub,
      requestContext(request),
    );
  }

  @Post('enrollment/verify')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Verify 2FA enrollment',
    description:
      'Requires a valid TOTP code; brute-force and rate-limit protections are enforced by the application service/configuration.',
  })
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
  @ApiOperation({
    summary: 'Verify login 2FA',
    description:
      'Public MFA challenge endpoint; the challenge token, TOTP/recovery verification and session issuance are handled by LoginService.',
  })
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
  @ApiOperation({
    summary: 'Regenerate recovery codes',
    description:
      'Authenticated re-authentication flow. Old recovery codes are invalidated by the application service.',
  })
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
  @ApiOperation({
    summary: 'Disable 2FA',
    description:
      'Authenticated secure re-authentication flow; password/TOTP/recovery verification is enforced by TwoFactorService.',
  })
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
