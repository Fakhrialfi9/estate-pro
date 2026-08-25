import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordHasherService } from '../../../../auth/application/services/password-hasher.service.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.js';
import { PasswordPolicy } from '../domain/policies/password.policy.js';
import type { CredentialRepository } from '../domain/repositories/credential.repository.js';
import { CREDENTIAL_REPOSITORY } from '../domain/repositories/credential.repository.js';
import { CredentialService } from './credential.service.js';

export interface PasswordResetDeliveryPayload {
  userUuid: string;
  token: string;
  expiresAt: Date;
}

export const PASSWORD_RESET_DELIVERY = Symbol('PASSWORD_RESET_DELIVERY');

export interface PasswordResetDelivery {
  deliver(payload: PasswordResetDeliveryPayload): Promise<void>;
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly policy = new PasswordPolicy();

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepository,
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly credentials: CredentialRepository,
    private readonly config: ConfigService,
    private readonly hasher: PasswordHasherService,
    @Inject(PASSWORD_RESET_DELIVERY)
    private readonly delivery: PasswordResetDelivery,
  ) {}

  async requestByEmail(email: string): Promise<{ accepted: true }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = normalizedEmail
      ? await this.users.findByEmail(normalizedEmail)
      : null;
    if (!user || !user.isAccessible()) return { accepted: true };

    const credential = await this.credentials.findByUserUuid(user.uuid);
    if (!credential) return { accepted: true };

    const token = CredentialService.generateResetToken();
    const ttlMinutes = this.config.getOrThrow<number>(
      'auth.passwordReset.tokenTtlMinutes',
    );
    if (!Number.isInteger(ttlMinutes) || ttlMinutes <= 0) {
      throw new Error('Invalid password reset TTL configuration');
    }
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    await this.credentials.createResetToken(
      user.uuid,
      CredentialService.digestResetToken(token),
      expiresAt,
    );

    try {
      await this.delivery.deliver({ userUuid: user.uuid, token, expiresAt });
    } catch (error: unknown) {
      this.logger.error(
        'Password reset delivery failed',
        error instanceof Error ? error.message : undefined,
      );
    }

    return { accepted: true };
  }

  async reset(
    rawToken: string,
    password: string,
    confirmation: string,
  ): Promise<void> {
    const policyResult = this.policy.validate(password);
    if (!policyResult.valid) {
      throw new Error(policyResult.reason ?? 'Invalid password');
    }
    if (password !== confirmation) {
      throw new Error('Password confirmation does not match');
    }

    const hash = await this.hasher.hash(password);
    const userUuid = await this.credentials.resetPasswordAtomically(
      CredentialService.digestResetToken(rawToken),
      hash,
      new Date(),
    );
    if (!userUuid) throw new Error('Password reset token is invalid or expired');
  }
}
