import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { SessionSecurityPort } from '../../../../../common/security/session-security.port.js';
import { SESSION_SECURITY_PORT } from '../../../../../common/security/session-security.port.js';
import { PasswordHasherService } from '../../../../auth/application/services/password-hasher.service.js';
import { PasswordPolicy } from '../../domain/policies/password.policy.js';
import type { CredentialRepository } from '../../domain/repositories/credential.repository.js';
import { CREDENTIAL_REPOSITORY } from '../../domain/repositories/credential.repository.js';
import {
  CredentialAlreadyExistsError,
  CredentialNotFoundError,
  CurrentPasswordVerificationError,
  InvalidPasswordConfirmationError,
  InvalidPasswordError,
} from '../../domain/errors/credential.errors.js';

export interface ChangePasswordCommand {
  userUuid: string;
  currentPassword: string;
  newPassword: string;
  confirmation: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

export interface CreateCredentialCommand {
  userUuid: string;
  password: string;
  confirmation: string;
}

@Injectable()
export class CredentialService {
  private readonly policy = new PasswordPolicy();

  constructor(
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly credentials: CredentialRepository,
    @Inject(SESSION_SECURITY_PORT)
    private readonly sessions: SessionSecurityPort,
    private readonly hasher: PasswordHasherService,
  ) {}

  async create(command: CreateCredentialCommand): Promise<void> {
    this.assertPassword(command.password, command.confirmation);
    const existing = await this.credentials.findByUserUuid(command.userUuid);
    if (existing) throw new CredentialAlreadyExistsError();

    const hash = await this.hasher.hash(command.password);
    await this.credentials.create(command.userUuid, hash);
  }

  async changePassword(command: ChangePasswordCommand): Promise<void> {
    const credential = await this.credentials.findByUserUuid(command.userUuid);
    if (!credential) throw new CredentialNotFoundError();

    const currentValid = await this.hasher.verify(
      credential.passwordHash,
      command.currentPassword,
    );
    if (!currentValid) throw new CurrentPasswordVerificationError();

    this.assertPassword(command.newPassword, command.confirmation);
    const hash = await this.hasher.hash(command.newPassword);
    await this.credentials.updatePassword(command.userUuid, hash, new Date());
    await this.sessions.revokeAllForSecurityEvent(
      command.userUuid,
      'PASSWORD_CHANGE',
      {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    );
  }

  static generateResetToken(): string {
    return randomBytes(32).toString('base64url');
  }

  static digestResetToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private assertPassword(password: string, confirmation: string): void {
    const result = this.policy.validate(password);
    if (!result.valid) throw new InvalidPasswordError(result.reason);
    try {
      this.policy.assertConfirmation(password, confirmation);
    } catch {
      throw new InvalidPasswordConfirmationError();
    }
  }
}
