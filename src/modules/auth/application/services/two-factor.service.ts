import { Injectable } from '@nestjs/common';
import { TwoFactorCryptoService } from './two-factor-crypto.service.js';
import type { SecurityAuditRepository } from '../../domain/repositories/security-audit.repository.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../domain/repositories/security-audit.repository.js';
import type { TwoFactorRepository } from '../../domain/repositories/two-factor.repository.js';
import { TWO_FACTOR_REPOSITORY } from '../../domain/repositories/two-factor.repository.js';
import type { TwoFactorRecoveryCodeRepository } from '../../domain/repositories/two-factor-recovery-code.repository.js';
import { TWO_FACTOR_RECOVERY_CODE_REPOSITORY } from '../../domain/repositories/two-factor-recovery-code.repository.js';
import type { TwoFactorChallengeRepository } from '../../domain/repositories/two-factor-challenge.repository.js';
import { TWO_FACTOR_CHALLENGE_REPOSITORY } from '../../domain/repositories/two-factor-challenge.repository.js';

export interface TwoFactorAuditContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

export const TWO_FACTOR_AUDIT_ACTIONS = {
  ENROLLMENT: '2FA_ENROLLMENT',
  ENABLED: '2FA_ENABLED',
  DISABLED: '2FA_DISABLED',
  RECOVERY_CODE_USED: '2FA_RECOVERY_CODE_USED',
  RECOVERY_CODES_REGENERATED: '2FA_RECOVERY_CODES_REGENERATED',
} as const;

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly crypto: TwoFactorCryptoService,
    @Inject(TWO_FACTOR_REPOSITORY)
    private readonly twoFactorRepository: TwoFactorRepository,
    @Inject(TWO_FACTOR_RECOVERY_CODE_REPOSITORY)
    private readonly recoveryCodeRepository: TwoFactorRecoveryCodeRepository,
    @Inject(TWO_FACTOR_CHALLENGE_REPOSITORY)
    private readonly challengeRepository: TwoFactorChallengeRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}
