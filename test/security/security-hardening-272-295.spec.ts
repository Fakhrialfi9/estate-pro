import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import { AuthController } from '../../src/modules/auth/presentation/auth.controller.js';
import { LoginService } from '../../src/modules/auth/application/services/login.service.js';
import { JwtTokenService } from '../../src/modules/auth/application/services/jwt-token.service.js';
import { JwtAuthGuard } from '../../src/modules/auth/security/jwt-auth.guard.js';
import { PrismaAuthenticationSessionRepository } from '../../src/modules/auth/infrastructure/persistence/prisma-authentication-session.repository.js';
import { UserProfileOwnershipPolicy } from '../../src/modules/users/profile/application/policies/user-profile-ownership.policy.js';
import { RoleAuthorizationPolicy } from '../../src/modules/roles/application/policies/role-authorization.policy.js';
import { PermissionManageAccessGuard } from '../../src/modules/permissions/security/permission-management-access.guard.js';
import { PrismaUserRepository } from '../../src/modules/users/infrastructure/persistence/prisma-user.repository.js';
import { UpdateUserDto } from '../../src/modules/users/application/dto/update-user.dto.js';
import { ChangePasswordDto } from '../../src/modules/users/credentials/application/dto/change-password.dto.js';
import { PasswordResetConfirmDto } from '../../src/modules/users/credentials/application/dto/password-reset.dto.js';
import { serializeUser } from '../../src/modules/users/application/serializers/user.serializer.js';
import securityConfig from '../../src/config/security.config.js';
import {
  LOGIN_RATE_LIMIT,
  TWO_FACTOR_VERIFICATION_RATE_LIMIT,
} from '../../src/config/rate-limit.config.js';
import {
  sanitizeAuditChanges,
  sanitizeAuditReason,
} from '../../src/common/audit/audit-redaction.js';
import { SENSITIVE_LOG_PATHS } from '../../src/common/constants/security.constants.js';
import { SecureValidationPipe } from '../../src/common/pipes/secure-validation.pipe.js';

const USER_A = '7e9d9c67-30a5-4d2c-a8df-70755f96ad35';
const USER_B = '11111111-1111-4111-8111-111111111111';
const JWT_SECRET = 'security-test-jwt-secret-012345678901234567890123';

type LoginSecurityState = {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
};

type LoginHarness = ReturnType<typeof createLoginHarness>;

function createLoginHarness(passwordValid: boolean) {
  const state: LoginSecurityState = {
    failedLoginAttempts: 0,
    lockedUntil: null,
  };
