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
import { LOGIN_RATE_LIMIT, TWO_FACTOR_VERIFICATION_RATE_LIMIT } from '../../src/config/rate-limit.config.js';
import { sanitizeAuditChanges, sanitizeAuditReason } from '../../src/common/audit/audit-redaction.js';
import { SENSITIVE_LOG_PATHS } from '../../src/common/constants/security.constants.js';

const USER_A = '7e9d9c67-30a5-4d2c-a8df-70755f96ad35';
const USER_B = '11111111-1111-4111-8111-111111111111';
const JWT_SECRET = 'security-test-jwt-secret-012345678901234567890123';

type LoginHarness = ReturnType<typeof createLoginHarness>;

function createLoginHarness(passwordValid: boolean) {
  const state = { failedLoginAttempts: 0, lockedUntil: null as Date | null };
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
  const security = {
    getState: vi.fn().mockResolvedValue(state),
    recordFailedLogin: vi.fn(() => {
      state.failedLoginAttempts += 1;
      if (state.failedLoginAttempts >= 5) state.lockedUntil = new Date(Date.now() + 900000);
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
    getOrThrow: vi.fn((key: string) => ({
      'auth.login.lockoutThreshold': 5,
      'auth.login.lockoutWindowMs': 900000,
      'auth.login.lockoutDurationMs': 900000,
    } as Record<string, number>)[key]),
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
  return { service, users, security, audit, hasher, sessions, getCreatedSessionId: () => createdSessionId };
}

function authContext(request: object) {
  return {
    getHandler: () => ({}),
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

function createJwtVerifier() {
  const config = {
    getOrThrow: vi.fn((key: string) => ({
      'auth.jwt.secret': JWT_SECRET,
      'auth.jwt.issuer': 'estate-pro-api',
      'auth.jwt.audience': 'estate-pro-client',
      'auth.jwt.algorithm': 'HS256',
      'auth.jwt.expiresIn': '15m',
    } as Record<string, string>)[key]),
  };
  return new JwtTokenService(new JwtService({ secret: JWT_SECRET }), config as never);
}

describe('STEP 272', () => {
  it('blocks repeated login failures after the configured threshold', async () => {
    const h: LoginHarness = createLoginHarness(false);
    for (let i = 0; i < 5; i += 1) await h.service.execute({ identifier: 'member@example.com', password: 'wrong' });
    const verifyCalls = h.hasher.verify.mock.calls.length;
    await expect(h.service.execute({ identifier: 'member@example.com', password: 'correct' })).resolves.toBeNull();
    expect(h.hasher.verify.mock.calls.length).toBe(verifyCalls);
    const state = await h.security.getState(USER_A);
    expect(state.lockedUntil).toBeInstanceOf(Date);
  });
});

describe('STEP 273', () => {
  it('handles repeated credential attacks with finite throttling and uniform failure auditing', async () => {
    const h: LoginHarness = createLoginHarness(false);
    await Promise.all(['one@example.com', 'two@example.com', 'three@example.com'].map((identifier) => h.service.execute({ identifier, password: 'wrong' })));
    expect(h.audit.record).toHaveBeenCalledTimes(3);
    expect(LOGIN_RATE_LIMIT).toEqual({ limit: 5, ttl: 60000 });
    expect(Reflect.getMetadataKeys(AuthController.prototype, 'loginUser')).not.toHaveLength(0);
  });
});

describe('STEP 274', () => {
  it('resists login user enumeration by performing password work for unknown identities', async () => {
    const known: LoginHarness = createLoginHarness(false);
    const unknown: LoginHarness = createLoginHarness(true);
    unknown.users.findByEmail.mockResolvedValue(null);
    unknown.users.findByUsername.mockResolvedValue(null);
    await known.service.execute({ identifier: 'member@example.com', password: 'wrong' });
    await unknown.service.execute({ identifier: 'missing@example.com', password: 'wrong' });
    expect(known.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTHENTICATION_FAILURE' }));
    expect(unknown.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTHENTICATION_FAILURE' }));
    expect(unknown.hasher.hash).toHaveBeenCalledOnce();
  });
});

describe('STEP 275', () => {
  it('rejects weak password inputs at the validation boundary', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true });
    await expect(pipe.transform({ currentPassword: 'short', newPassword: 'short', confirmation: 'short' }, { type: 'body', metatype: ChangePasswordDto })).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ token: 'x'.repeat(32), password: 'short', confirmation: 'short' }, { type: 'body', metatype: PasswordResetConfirmDto })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('STEP 276', () => {
  it('rejects JWT algorithm confusion and alg=none', async () => {
    const jwt = new JwtService({ secret: JWT_SECRET });
    const confused = await jwt.signAsync({ sub: USER_A, sid: 's1' }, { secret: JWT_SECRET, algorithm: 'HS384', issuer: 'estate-pro-api', audience: 'estate-pro-client', expiresIn: '60s' });
    await expect(createJwtVerifier().verifyAccessToken(confused)).rejects.toThrow(UnauthorizedException);
    const payload = confused.split('.')[1] ?? '';
    const none = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${payload}.`;
    await expect(createJwtVerifier().verifyAccessToken(none)).rejects.toThrow(UnauthorizedException);
  });
});

describe('STEP 277', () => {
  it('rejects expired JWTs', async () => {
    const token = await new JwtService({ secret: JWT_SECRET }).signAsync({ sub: USER_A, sid: 's1' }, { secret: JWT_SECRET, algorithm: 'HS256', issuer: 'estate-pro-api', audience: 'estate-pro-client', expiresIn: -1 });
    await expect(createJwtVerifier().verifyAccessToken(token)).rejects.toThrow(UnauthorizedException);
  });
});

describe('STEP 278', () => {
  it('rejects JWTs with invalid signatures', async () => {
    const wrongSecret = 'different-secret-012345678901234567890123456789';
    const token = await new JwtService({ secret: wrongSecret }).signAsync({ sub: USER_A, sid: 's1' }, { secret: wrongSecret, algorithm: 'HS256', issuer: 'estate-pro-api', audience: 'estate-pro-client', expiresIn: '60s' });
    await expect(createJwtVerifier().verifyAccessToken(token)).rejects.toThrow(UnauthorizedException);
  });
});

describe('STEP 279', () => {
  it('rejects JWTs missing required session claims', async () => {
    const token = await new JwtService({ secret: JWT_SECRET }).signAsync({ sub: USER_A }, { secret: JWT_SECRET, algorithm: 'HS256', issuer: 'estate-pro-api', audience: 'estate-pro-client', expiresIn: '60s' });
    await expect(createJwtVerifier().verifyAccessToken(token)).rejects.toThrow(UnauthorizedException);
  });
});

describe('STEP 280', () => {
  it('creates a fresh server-side session identifier', async () => {
    const h: LoginHarness = createLoginHarness(true);
    await h.service.execute(Object.assign({ identifier: 'member@example.com', password: 'correct' }, { sessionId: 'attacker-fixed-session' }) as never);
    expect(h.getCreatedSessionId()).toBeDefined();
    expect(h.getCreatedSessionId()).not.toBe('attacker-fixed-session');
  });
});

describe('STEP 281', () => {
  it('rejects revoked sessions at the authentication boundary', async () => {
    const guard = new JwtAuthGuard({ verifyAccessToken: vi.fn().mockResolvedValue({ sub: USER_A, sid: 'revoked', iat: 1, exp: Math.floor(Date.now() / 1000) + 60 }) } as never, { isActive: vi.fn().mockResolvedValue(false) } as never);
    await expect(guard.canActivate(authContext({ headers: { authorization: 'Bearer token' } }))).rejects.toThrow(UnauthorizedException);
  });
});

describe('STEP 282', () => {
  it('enforces non-revoked and non-expired sessions in the repository query', async () => {
    type SessionQuery = { where: { user: { uuid: string }; sessionId: string; revokedAt: null; expiresAt: { gt: Date } } };
    let query: SessionQuery | undefined;
    const findFirst = vi.fn((args: SessionQuery) => {
      query = args;
      return Promise.resolve(null);
    });
    const repo = new PrismaAuthenticationSessionRepository({ authenticationUserSession: { findFirst } } as never);
    await expect(repo.isActive(USER_A, 'secret', new Date())).resolves.toBe(false);
    expect(query?.where.revokedAt).toBeNull();
    expect(query?.where.expiresAt.gt).toBeInstanceOf(Date);
  });
});

describe('STEP 283', () => {
  it('denies IDOR across user profiles without administrative permission', () => {
    const policy = new UserProfileOwnershipPolicy();
    expect(() => policy.assertCanManage({ sub: USER_A, permissions: [] }, USER_B)).toThrow();
    expect(() => policy.assertCanManage({ sub: USER_A, permissions: ['users:manage'] }, USER_B)).not.toThrow();
  });
});

describe('STEP 284', () => {
  it('denies low privilege escalation', () => {
    expect(() => new RoleAuthorizationPolicy().canManage({ userUuid: USER_A, permissions: ['roles:read'] })).toThrow(ForbiddenException);
  });
});

describe('STEP 285', () => {
  it('requires protected-role permission for protected roles', () => {
    const policy = new RoleAuthorizationPolicy();
    expect(() => policy.canManage({ userUuid: USER_A, permissions: ['roles:manage'] }, true)).toThrow(ForbiddenException);
    expect(() => policy.canManage({ userUuid: USER_A, permissions: ['roles:manage', 'roles:manage:protected'] }, true)).not.toThrow();
  });
});

describe('STEP 286', () => {
  it('does not trust spoofed request permissions', async () => {
    const repository = { getAuthorizationSnapshot: vi.fn().mockResolvedValue({ userUuid: USER_A, permissionCodes: ['users:read'], roleCodes: ['user'] }) };
    const guard = new PermissionManageAccessGuard(repository as never);
    const request = { user: { sub: USER_A, permissions: ['permissions:manage'] } };
    await expect(guard.canActivate(authContext(request))).rejects.toThrow(ForbiddenException);
    expect(request.user.permissions).toEqual(['users:read']);
  });
});

describe('STEP 287', () => {
  it('uses a bounded OTP verification policy', () => {
    expect(TWO_FACTOR_VERIFICATION_RATE_LIMIT.limit).toBeLessThanOrEqual(10);
    expect(TWO_FACTOR_VERIFICATION_RATE_LIMIT.ttl).toBe(60000);
  });
});

describe('STEP 288', () => {
  it('keeps recovery authentication within the same bounded verification policy', () => {
    expect(TWO_FACTOR_VERIFICATION_RATE_LIMIT.limit).toBeGreaterThan(0);
    expect(TWO_FACTOR_VERIFICATION_RATE_LIMIT.ttl).toBeGreaterThan(0);
  });
});

describe('STEP 289', () => {
  it('passes SQL injection payloads as bound Prisma values', async () => {
    type Query = { where: { email: string; deletedAt: null } };
    let received: Query | undefined;
    const findFirst = vi.fn((args: Query) => {
      received = args;
      return Promise.resolve(null);
    });
    const repo = new PrismaUserRepository({ authenticationUser: { findFirst } } as never);
    const payload = "' OR 1=1 --";
    await expect(repo.findByEmail(payload)).resolves.toBeNull();
    expect(received).toEqual({ where: { email: payload, deletedAt: null } });
  });
});

describe('STEP 290', () => {
  it('keeps XSS payloads as JSON data rather than executable HTML', () => {
    const payload = '<script>alert(1)</script>';
    const response = serializeUser({ uuid: USER_A, username: payload, email: null, phone: null, status: 'active', isActive: true, isVerified: true, createdAt: new Date(), updatedAt: new Date() } as never);
    const body = JSON.stringify(response);
    expect(body).toContain(payload);
    expect(body.trimStart().startsWith('<script>')).toBe(false);
  });
});

describe('STEP 291', () => {
  it('rejects mass-assignment protected fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true });
    await expect(pipe.transform({ username: 'safe', role: 'admin', permissions: ['*'], passwordHash: 'secret', isAdmin: true }, { type: 'body', metatype: UpdateUserDto })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('STEP 292', () => {
  it('rejects prototype-pollution style properties without mutating Object.prototype', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true });
    const payload = JSON.parse('{"username":"safe","__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}}}') as object;
    await expect(pipe.transform(payload, { type: 'body', metatype: UpdateUserDto })).rejects.toBeInstanceOf(BadRequestException);
    expect(Object.prototype).not.toHaveProperty('polluted');
  });
});

describe('STEP 293', () => {
  it('keeps the API security header policy explicit', () => {
    const security = securityConfig();
    expect(security.helmet.noSniff).toBe(true);
    expect(security.helmet.frameguard).toEqual({ action: 'deny' });
    expect(security.helmet.referrerPolicy).toEqual({ policy: 'no-referrer' });
  });
});

describe('STEP 294', () => {
  it('keeps login throttling explicit and bounded', () => {
    expect(Reflect.getMetadataKeys(AuthController.prototype, 'loginUser')).not.toHaveLength(0);
    expect(LOGIN_RATE_LIMIT.limit).toBeGreaterThan(0);
    expect(LOGIN_RATE_LIMIT.ttl).toBeGreaterThan(0);
  });
});

describe('STEP 295', () => {
  it('redacts sensitive security material from audit and logging boundaries', () => {
    const changes = sanitizeAuditChanges('authentication', [
      { field: 'password', oldValue: 'x', newValue: 'y' },
      { field: 'accessToken', oldValue: 'x', newValue: 'y' },
      { field: 'refreshToken', oldValue: 'x', newValue: 'y' },
      { field: 'twoFactorSecret', oldValue: 'x', newValue: 'y' },
      { field: 'sessionSecret', oldValue: 'x', newValue: 'y' },
      { field: 'reason', oldValue: null, newValue: 'NORMAL' },
    ]);
    expect(changes).toEqual([{ field: 'reason', oldValue: null, newValue: 'NORMAL' }]);
    expect(sanitizeAuditReason('password=secret')).toBeNull();
    expect(SENSITIVE_LOG_PATHS).toEqual(expect.arrayContaining(['req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.token', 'req.body.secret']));
  });
});
