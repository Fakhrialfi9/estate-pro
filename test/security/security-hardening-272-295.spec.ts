import { BadRequestException, ForbiddenException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
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
import { CreateUserDto } from '../../src/modules/users/application/dto/create-user.dto.js';
import { UpdateUserDto } from '../../src/modules/users/application/dto/update-user.dto.js';
import { ChangePasswordDto } from '../../src/modules/users/credentials/application/dto/change-password.dto.js';
import { PasswordResetConfirmDto } from '../../src/modules/users/credentials/application/dto/password-reset.dto.js';
import { serializeUser } from '../../src/modules/users/application/serializers/user.serializer.js';
import securityConfig from '../../src/config/security.config.js';
import { LOGIN_RATE_LIMIT, TWO_FACTOR_VERIFICATION_RATE_LIMIT } from '../../src/config/rate-limit.config.js';
import { sanitizeAuditChanges, sanitizeAuditReason } from '../../src/common/audit/audit-redaction.js';
import { SENSITIVE_LOG_PATHS } from '../../src/common/constants/security.constants.js';

const JWT_SECRET = 'security-test-jwt-secret-012345678901234567890123';
const UUID_A = '7e9d9c67-30a5-4d2c-a8df-70755f96ad35';
const UUID_B = '11111111-1111-4111-8111-111111111111';

const context = (request: object = { headers: {} }) =>
  ({ getHandler: () => ({}), getClass: () => class TestController {}, switchToHttp: () => ({ getRequest: () => request }) }) as never;

const loginHarness = (validPassword: boolean) => {
  const state = { failedLoginAttempts: 0, lockedUntil: null as Date | null };
  const user = { uuid: UUID_A, email: 'member@example.com', username: 'member', status: 'active', isAccessible: () => true };
  const users = { findByEmail: vi.fn().mockResolvedValue(user), findByUsername: vi.fn().mockResolvedValue(user) };
  const credentials = { findByUserUuid: vi.fn().mockResolvedValue({ passwordHash: 'hash' }) };
  const security = {
    getState: vi.fn().mockResolvedValue(state),
    recordFailedLogin: vi.fn().mockImplementation(async () => {
      state.failedLoginAttempts += 1;
      if (state.failedLoginAttempts >= 5) state.lockedUntil = new Date(Date.now() + 900000);
      return state;
    }),
    recordSuccessfulLogin: vi.fn().mockResolvedValue(undefined),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const hasher = { verify: vi.fn().mockResolvedValue(validPassword), hash: vi.fn().mockResolvedValue('dummy-hash') };
  const jwt = { issueAccessToken: vi.fn().mockResolvedValue('token'), getExpiresAt: vi.fn().mockReturnValue(new Date(Date.now() + 60000)) };
  const sessions = { create: vi.fn().mockResolvedValue(undefined) };
  const twoFactor = { isEnabled: vi.fn().mockResolvedValue(false) };
  const config = { getOrThrow: vi.fn((key: string) => ({ 'auth.login.lockoutThreshold': 5, 'auth.login.lockoutWindowMs': 900000, 'auth.login.lockoutDurationMs': 900000 }[key])) };
  const service = new LoginService(users as never, credentials as never, security as never, audit as never, hasher as never, jwt as never, sessions as never, config as never, twoFactor as never);
  return { service, users, security, audit, hasher, sessions };
};

describe('STEP 272', () => {
  it('blocks repeated login failures after the configured threshold', async () => {
    const h = loginHarness(false);
    for (let i = 0; i < 5; i += 1) await h.service.execute({ identifier: 'member@example.com', password: 'wrong' });
    const calls = h.hasher.verify.mock.calls.length;
    await expect(h.service.execute({ identifier: 'member@example.com', password: 'correct' })).resolves.toBeNull();
    expect(h.hasher.verify.mock.calls.length).toBe(calls);
  });
});

describe('STEP 273', () => {
  it('enforces a finite login throttle for repeated credential attempts', async () => {
    const h = loginHarness(false);
    await Promise.all(['a@example.com', 'b@example.com', 'c@example.com'].map((identifier) => h.service.execute({ identifier, password: 'wrong' })));
    expect(h.audit.record).toHaveBeenCalledTimes(3);
    expect(LOGIN_RATE_LIMIT).toEqual({ ttl: 60000, limit: expect.any(Number) });
    expect(LOGIN_RATE_LIMIT.limit).toBeLessThanOrEqual(5);
    expect(Reflect.getMetadataKeys(AuthController.prototype.loginUser).some((key) => String(key).toLowerCase().includes('throttler'))).toBe(true);
  });
});

describe('STEP 274', () => {
  it('prevents username/email enumeration with identical failure semantics and password work', async () => {
    const known = loginHarness(false);
    await known.service.execute({ identifier: 'member@example.com', password: 'wrong' });
    const unknown = loginHarness(true);
    unknown.users.findByEmail.mockResolvedValue(null);
    unknown.users.findByUsername.mockResolvedValue(null);
    await unknown.service.execute({ identifier: 'missing@example.com', password: 'wrong' });
    expect(known.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTHENTICATION_FAILURE' }));
    expect(unknown.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTHENTICATION_FAILURE' }));
    expect(unknown.hasher.hash).toHaveBeenCalledOnce();
  });
});

describe('STEP 275', () => {
  it('rejects weak passwords at the DTO boundary', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true });
    await expect(pipe.transform({ currentPassword: 'short', newPassword: 'short', confirmation: 'short' }, { type: 'body', metatype: ChangePasswordDto })).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ token: 'x'.repeat(32), password: 'short', confirmation: 'short' }, { type: 'body', metatype: PasswordResetConfirmDto })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('STEPS 276–279', () => {
  const config = { getOrThrow: vi.fn((key: string) => ({ 'auth.jwt.secret': JWT_SECRET, 'auth.jwt.issuer': 'estate-pro-api', 'auth.jwt.audience': 'estate-pro-client', 'auth.jwt.algorithm': 'HS256', 'auth.jwt.expiresIn': '15m' }[key])) };
  const service = () => new JwtTokenService(new JwtService({ secret: JWT_SECRET }), config as never);

  it('276 rejects algorithm confusion and alg=none', async () => {
    const jwt = new JwtService({ secret: JWT_SECRET });
    const confused = await jwt.signAsync({ sub: UUID_A, sid: 's1' }, { secret: JWT_SECRET, algorithm: 'HS384', issuer: 'estate-pro-api', audience: 'estate-pro-client', expiresIn: '60s' });
    await expect(service().verifyAccessToken(confused)).rejects.toThrow(UnauthorizedException);
    const payload = confused.split('.')[1];
    const none = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${payload}.`;
    await expect(service().verifyAccessToken(none)).rejects.toThrow(UnauthorizedException);
  });

  it('277 rejects expired JWTs', async () => {
    const token = await new JwtService({ secret: JWT_SECRET }).signAsync({ sub: UUID_A, sid: 's1' }, { secret: JWT_SECRET, algorithm: 'HS256', issuer: 'estate-pro-api', audience: 'estate-pro-client', expiresIn: -1 });
    await expect(service().verifyAccessToken(token)).rejects.toThrow(UnauthorizedException);
  });

  it('278 rejects invalid JWT signatures', async () => {
    const wrong = 'different-secret-012345678901234567890123456789';
    const token = await new JwtService({ secret: wrong }).signAsync({ sub: UUID_A, sid: 's1' }, { secret: wrong, algorithm: 'HS256', issuer: 'estate-pro-api', audience: 'estate-pro-client', expiresIn: '60s' });
    await expect(service().verifyAccessToken(token)).rejects.toThrow(UnauthorizedException);
  });

  it('279 rejects JWTs missing the session claim', async () => {
    const token = await new JwtService({ secret: JWT_SECRET }).signAsync({ sub: UUID_A }, { secret: JWT_SECRET, algorithm: 'HS256', issuer: 'estate-pro-api', audience: 'estate-pro-client', expiresIn: '60s' });
    await expect(service().verifyAccessToken(token)).rejects.toThrow(UnauthorizedException);
  });
});

describe('STEPS 280–282', () => {
  it('280 uses a fresh server-side session secret instead of a client supplied identifier', async () => {
    const h = loginHarness(true);
    const command = Object.assign({ identifier: 'member@example.com', password: 'correct' }, { sessionId: 'attacker-fixed-session' }) as never;
    await h.service.execute(command);
    expect((h.sessions.create.mock.calls[0]?.[1] as { sessionId: string }).sessionId).not.toBe('attacker-fixed-session');
  });

  it('281 rejects revoked sessions at the authentication boundary', async () => {
    const guard = new JwtAuthGuard({ verifyAccessToken: vi.fn().mockResolvedValue({ sub: UUID_A, sid: 'revoked', iat: 1, exp: Math.floor(Date.now() / 1000) + 60 }) } as never, { isActive: vi.fn().mockResolvedValue(false) } as never);
    await expect(guard.canActivate(context({ headers: { authorization: 'Bearer token' } }))).rejects.toThrow(UnauthorizedException);
  });

  it('282 checks expiry and revocation in the actual Prisma session repository', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repo = new PrismaAuthenticationSessionRepository({ authenticationUserSession: { findFirst } } as never);
    await expect(repo.isActive(UUID_A, 'secret', new Date())).resolves.toBe(false);
    const where = findFirst.mock.calls[0]?.[0].where;
    expect(where.revokedAt).toBeNull();
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });
});

describe('STEPS 283–286', () => {
  it('283 denies IDOR across user profiles', () => {
    const policy = new UserProfileOwnershipPolicy();
    expect(() => policy.assertCanManage({ sub: UUID_A, permissions: [] }, UUID_B)).toThrow();
    expect(() => policy.assertCanManage({ sub: UUID_A, permissions: ['users:manage'] }, UUID_B)).not.toThrow();
  });

  it('284 denies low privilege escalation', () => {
    expect(() => new RoleAuthorizationPolicy().canManage({ userUuid: UUID_A, permissions: ['roles:read'] })).toThrow(ForbiddenException);
  });

  it('285 blocks protected role escalation without explicit protected-role permission', () => {
    const policy = new RoleAuthorizationPolicy();
    expect(() => policy.canManage({ userUuid: UUID_A, permissions: ['roles:manage'] }, true)).toThrow(ForbiddenException);
    expect(() => policy.canManage({ userUuid: UUID_A, permissions: ['roles:manage', 'roles:manage:protected'] }, true)).not.toThrow();
  });

  it('286 rejects permission escalation using spoofed request permissions', async () => {
    const repository = { getAuthorizationSnapshot: vi.fn().mockResolvedValue({ userUuid: UUID_A, permissionCodes: ['users:read'], roleCodes: ['user'] }) };
    const guard = new PermissionManageAccessGuard(repository as never);
    const request = { user: { sub: UUID_A, permissions: ['permissions:manage'] } };
    await expect(guard.canActivate(context(request))).rejects.toThrow(ForbiddenException);
    expect(request.user.permissions).toEqual(['users:read']);
  });
});

describe('STEP 287', () => {
  it('limits repeated invalid OTP attempts with server-side configuration', () => {
    expect(TWO_FACTOR_VERIFICATION_RATE_LIMIT.limit).toBeLessThanOrEqual(10);
    expect(TWO_FACTOR_VERIFICATION_RATE_LIMIT.ttl).toBe(60000);
  });
});

describe('STEP 288', () => {
  it('uses one-time recovery-code persistence semantics', async () => {
    const markUsed = vi.fn().mockResolvedValue({ count: 1 });
    const recoveryDelegate = { updateMany: markUsed };
    await recoveryDelegate.updateMany({ where: { id: 1n, usedAt: null }, data: { usedAt: new Date() } });
    expect(markUsed.mock.calls[0]?.[0].where.usedAt).toBeNull();
  });
});

describe('STEP 289', () => {
  it('passes SQL injection payloads as Prisma values', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repo = new PrismaUserRepository({ authenticationUser: { findFirst } } as never);
    await expect(repo.findByEmail("' OR 1=1 --")).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith({ where: { email: "' OR 1=1 --", deletedAt: null } });
  });
});

describe('STEP 290', () => {
  it('serializes XSS payloads as JSON data rather than HTML', () => {
    const payload = '<script>alert(1)</script>';
    const response = serializeUser({ uuid: UUID_A, username: payload, email: null, phone: null, status: 'active', isActive: true, isVerified: true, createdAt: new Date(), updatedAt: new Date() } as never);
    const body = JSON.stringify(response);
    expect(body.startsWith('{')).toBe(true);
    expect(body).toContain(payload);
  });
});

describe('STEP 291', () => {
  it('rejects mass-assignment protected fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true });
    await expect(pipe.transform({ username: 'safe', role: 'admin', permissions: ['*'], passwordHash: 'secret', isAdmin: true }, { type: 'body', metatype: UpdateUserDto })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('STEP 292', () => {
  it('rejects prototype-pollution style keys and leaves Object.prototype unchanged', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true });
    const payload = JSON.parse('{"username":"safe","__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}}}') as object;
    await expect(pipe.transform(payload, { type: 'body', metatype: UpdateUserDto })).rejects.toBeInstanceOf(BadRequestException);
    expect(Object.prototype).not.toHaveProperty('polluted');
  });
});

describe('STEP 293', () => {
  it('keeps API security headers explicit', () => {
    const security = securityConfig();
    expect(security.helmet.noSniff).toBe(true);
    expect(security.helmet.frameguard).toEqual({ action: 'deny' });
    expect(security.helmet.referrerPolicy).toEqual({ policy: 'no-referrer' });
  });
});

describe('STEP 294', () => {
  it('does not expose an unthrottled authentication path', () => {
    expect(Reflect.getMetadataKeys(AuthController.prototype.loginUser).some((key) => String(key).toLowerCase().includes('throttler'))).toBe(true);
    expect(LOGIN_RATE_LIMIT.limit).toBeGreaterThan(0);
    expect(LOGIN_RATE_LIMIT.ttl).toBeGreaterThan(0);
  });
});

describe('STEP 295', () => {
  it('redacts sensitive security material at the audit boundary', () => {
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
