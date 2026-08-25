import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../profile/security/profile-authentication.guard.js';
import { ProfileAuthenticationGuard } from '../../profile/security/profile-authentication.guard.js';
import { ChangePasswordDto } from '../application/dto/change-password.dto.js';
import {
  PasswordResetRequestDto,
  PasswordResetConfirmDto,
} from '../application/dto/password-reset.dto.js';
import { CredentialService } from '../application/services/credential.service.js';
import { PasswordResetService } from '../application/services/password-reset.service.js';
import {
  CurrentPasswordVerificationError,
  CredentialNotFoundError,
  InvalidPasswordConfirmationError,
  InvalidPasswordError,
} from '../domain/errors/credential.errors.js';

@Controller({ path: '', version: '1' })
export class CredentialsController {
  constructor(
    private readonly credentials: CredentialService,
    private readonly resets: PasswordResetService,
  ) {}

  @Post('password-reset')
  async requestReset(@Body() dto: PasswordResetRequestDto) {
    await this.resets.requestByEmail(dto.email);
    return {
      message:
        'If the account exists, password reset instructions have been sent.',
    };
  }

  @Post('password-reset/confirm')
  async confirmReset(@Body() dto: PasswordResetConfirmDto) {
    try {
      await this.resets.reset(dto.token, dto.password, dto.confirmation);
      return { message: 'Password has been reset successfully.' };
    } catch {
      throw new BadRequestException('Invalid password reset request');
    }
  }

  @Post('users/me/password')
  @UseGuards(ProfileAuthenticationGuard)
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    const userUuid = request.user?.sub;
    if (!userUuid) throw new UnauthorizedException();

    try {
      await this.credentials.changePassword({
        userUuid,
        currentPassword: dto.currentPassword,
        newPassword: dto.newPassword,
        confirmation: dto.confirmation,
      });
      return { message: 'Password changed successfully.' };
    } catch (error: unknown) {
      if (
        error instanceof CurrentPasswordVerificationError ||
        error instanceof CredentialNotFoundError
      ) {
        throw new UnauthorizedException('Current password verification failed');
      }
      if (
        error instanceof InvalidPasswordError ||
        error instanceof InvalidPasswordConfirmationError
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
