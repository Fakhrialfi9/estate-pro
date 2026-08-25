import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  ValidationPipe,
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
  const user = {
    uuid: USER_A,
    email: 'member@example.com',
    username: 'member',
    status: 'active',
    isAccessible: () => true,
  };
  const users = {
    findByEmail: vi.fn().mockResolvedValue(user),
    findByUsername: vi.fn().mockResolvedValue(user),
  };
  const credentials = {
    findByUserUuid: vi.fn().mockResolvedValue({ passwordHash: 'argon2-hash' }),
  };
  const getState = vi
    .fn<() => Promise<LoginSecurityState>>()
    .mockResolvedValue(state);
  const security = {
    getState,
    recordFailedLogin: vi.fn(() => {
      state.failedLoginAttempts += 1;
      if (state.failedLoginAttempts >= 5)
        state.lockedUntil = new Date(Date.now() + 900000);
      return Promise.resolve(state);
    }),
    recordSuccessfulLogin: vi.fn().mockResolvedValue(undefined),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const hasher = {
    verify: vi.fn().mockResolvedValue(passwordValid),
    hash: vi.fn().mockResolvedValue('dummy-hash'),
  };
  const jwt = {
    issueAccessToken: vi.fn().mockResolvedValue('signed.jwt'),
    getExpiresAt: vi.fn().mockReturnValue(new Date(Date.now() + 60000)),
  };
  let createdSessionId: string | undefined;
  const sessions = {
    create: vi.fn((_userUuid: string, input: { sessionId: string }) => {
      createdSessionId = input.sessionId;
      return Promise.resolve();
    }),
  };
  const twoFactor = { isEnabled: vi.fn().mockResolvedValue(false) };
  const config = {
    getOrThrow: vi.fn(
      (key: string) =>
        (
          ({
            'auth.login.lockoutThreshold': 5,
            'auth.login.lockoutWindowMs': 900000,
            'auth.login.lockoutDurationMs': 900000,
          }) as Record<string, number>
        )[key],
    ),
  };
  const service = new LoginService(
    users as never,
    credentials as never,
    security as never,
    audit as never,
    hasher as never,
    jwt as never,
    sessions as never,
    config as never,
    twoFactor as never,
  );
  return {
    service,
    users,
    security,
    audit,
    hasher,
    sessions,
    getCreatedSessionId: () => createdSessionId,
  };
}

function authContext(request: object) {
  return {
    getHandler: () => ({}),
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request }),
  };
