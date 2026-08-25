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

const JWT_SECRET = 'security-test-jwt-secret-012345678901234567890123';
const USER_A = '7e9d9c67-30a5-4d2c-a8df-70755f96ad35';
const USER_B = '11111111-1111-4111-8111-111111111111';

type LoginHarness = ReturnType<typeof makeLoginHarness>;

const makeLoginHarness = (passwordValid: boolean) => {
  const state = {
    failedLoginAttempts: 0,
    lockedUntil: null as Date | null,
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
    findByUserUuid: vi.fn().mockResolvedValue({ passwordHash: 'hash' }),
  };
  const security = {
    getState: vi.fn().mockResolvedValue(state),
    recordFailedLogin: vi.fn(() => {
      state.failedLoginAttempts += 1;
      if (state.failedLoginAttempts >= 5) {
        state.lockedUntil = new Date(Date.now() + 900000);
      }
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
    issueAccessToken: vi.fn().mockResolvedValue('token'),
    getExpiresAt: vi.fn().mockReturnValue(new Date(Date.now() + 60000)),
  };
  const sessions = { create: vi.fn().mockResolvedValue(undefined) };
  const twoFactor = { isEnabled: vi.fn().mockResolvedValue(false) };
  const config = {
    getOrThrow: vi.fn((key: string) => {
      const values: Record<string, number> = {
        'auth.login.lockoutThreshold': 5,
        'auth.login.lockoutWindowMs': 900000,
        'auth.login.lockoutDurationMs': 900000,
      };
      return values[key];
    }),
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
  return { service, users, security, audit, hasher, sessions };
};

const authContext = (request: object) =>
  ({
    getHandler: () => ({}),
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request }),
  }) as never;

describe('STEP 272 — brute force', () => {
  it('locks repeated failures and prevents further password verification', async () => {
    const h: LoginHarness = makeLoginHarness(false);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await h.service.execute({
        identifier: 'member@example.com',
        password: 'wrong',
      });
    }
    const verifyCalls = h.hasher.verify.mock.calls.length;
    await expect(
      h.service.execute({
        identifier: 'member@example.com',
        password: 'correct',
      }),
    ).resolves.toBeNull();
    expect(h.hasher.verify.mock.calls.length).toBe(verifyCalls);
    expect((await h.security.getState(USER_A)).lockedUntil).toBeInstanceOf(
      Date,
    );
  });
});

describe('STEP 273 — credential stuffing', () => {
  it('uses uniform authentication failures with a finite login limit', async () => {
    const h: LoginHarness = makeLoginHarness(false);
    await Promise.all(
      ['one@example.com', 'two@example.com', 'three@example.com'].map(
        (identifier) => h.service.execute({ identifier, password: 'wrong' }),
      ),
    );
    expect(h.audit.record).toHaveBeenCalledTimes(3);
    expect(LOGIN_RATE_LIMIT.limit).toBe(5);
    expect(LOGIN_RATE_LIMIT.ttl).toBe(60000);
    expect(
      Reflect.getMetadataKeys(AuthController.prototype, 'loginUser'),
    ).not.toHaveLength(0);
  });
});

describe('STEP 274 — user enumeration', () => {
  it('performs equivalent password work for an unknown identity', async () => {
    const known: LoginHarness = makeLoginHarness(false);
    await known.service.execute({
      identifier: 'member@example.com',
      password: 'wrong',
    });

    const unknown: LoginHarness = makeLoginHarness(true);
    unknown.users.findByEmail.mockResolvedValue(null);
    unknown.users.findByUsername.mockResolvedValue(null);
    await unknown.service.execute({
      identifier: 'missing@example.com',
      password: 'wrong',
    });

    expect(known.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTHENTICATION_FAILURE' }),
    );
    expect(unknown.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTHENTICATION_FAILURE' }),
    );
    expect(unknown.hasher.hash).toHaveBeenCalledOnce();
  });
});

describe('STEP 275 — weak password', () => {
  it('rejects weak password values at the validation boundary', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });
    await expect(
      pipe.transform(
        {
          currentPassword: 'short',
          newPassword: 'short',
          confirmation: 'short',
        },
        { type: 'body', metatype: ChangePasswordDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      pipe.transform(
        { token: 'x'.repeat(32), password: 'short', confirmation: 'short' },
        { type: 'body', metatype: PasswordResetConfirmDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

const jwtConfig = {
  getOrThrow: vi.fn((key: string) => {
    const values: Record<string, string> = {
      'auth.jwt.secret': JWT_SECRET,
      'auth.jwt.issuer': 'estate-pro-api',
      'auth.jwt.audience': 'estate-pro-client',
      'auth.jwt.algorithm': 'HS256',
      'auth.jwt.expiresIn': '15m',
    };
    return values[key];
  }),
};

const makeJwtService = () =>
  new JwtTokenService(
    new JwtService({ secret: JWT_SECRET }),
    jwtConfig as never,
  );

describe('STEP 276 — JWT algorithm confusion', () => {
  it('rejects unsupported algorithms and alg=none', async () => {
    const jwt = new JwtService({ secret: JWT_SECRET });
    const confused = await jwt.signAsync(
      { sub: USER_A, sid: 'session' },
      {
        secret: JWT_SECRET,
        algorithm: 'HS384',
        issuer: 'estate-pro-api',
        audience: 'estate-pro-client',
        expiresIn: '60s',
      },
    );
    await expect(makeJwtService().verifyAccessToken(confused)).rejects.toThrow(
      UnauthorizedException,
    );
    const payload = confused.split('.')[1] ?? '';
    const none = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${payload}.`;
    await expect(makeJwtService().verifyAccessToken(none)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('STEP 277 — expired JWT', () => {
  it('rejects expired access tokens', async () => {
    const token = await new JwtService({ secret: JWT_SECRET }).signAsync(
      { sub: USER_A, sid: 'session' },
      {
        secret: JWT_SECRET,
        algorithm: 'HS256',
        issuer: 'estate-pro-api',
        audience: 'estate-pro-client',
        expiresIn: -1,
      },
    );
    await expect(makeJwtService().verifyAccessToken(token)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('STEP 278 — invalid JWT signature', () => {
  it('rejects a token signed with a different secret', async () => {
    const wrongSecret = 'different-secret-012345678901234567890123456789';
    const token = await new JwtService({ secret: wrongSecret }).signAsync(
      { sub: USER_A, sid: 'session' },
      {
        secret: wrongSecret,
        algorithm: 'HS256',
        issuer: 'estate-pro-api',
        audience: 'estate-pro-client',
        expiresIn: '60s',
      },
    );
    await expect(makeJwtService().verifyAccessToken(token)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('STEP 279 — missing JWT claims', () => {
  it('rejects an access token without the required session claim', async () => {
    const token = await new JwtService({ secret: JWT_SECRET }).signAsync(
      { sub: USER_A },
      {
        secret: JWT_SECRET,
        algorithm: 'HS256',
        issuer: 'estate-pro-api',
        audience: 'estate-pro-client',
        expiresIn: '60s',
      },
    );
    await expect(makeJwtService().verifyAccessToken(token)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('STEP 280 — session fixation', () => {
  it('ignores a client-controlled session identifier and creates a fresh session', async () => {
    const h: LoginHarness = makeLoginHarness(true);
    const command = Object.assign(
      { identifier: 'member@example.com', password: 'correct' },
      { sessionId: 'attacker-fixed-session' },
    ) as never;
    await h.service.execute(command);
    const createCalls = h.sessions.create.mock.calls.length;
    expect(createCalls).toBeGreaterThan(0);
    const created = h.sessions.create.mock.calls[createCalls - 1]?.[1] as {
      sessionId: string;
    };
    expect(created.sessionId).not.toBe('attacker-fixed-session');
  });
});

describe('STEP 281 — revoked session', () => {
  it('rejects authentication when the server-side session is revoked', async () => {
    const guard = new JwtAuthGuard(
      {
        verifyAccessToken: vi.fn().mockResolvedValue({
          sub: USER_A,
          sid: 'revoked',
          iat: 1,
          exp: Math.floor(Date.now() / 1000) + 60,
        }),
      } as never,
      { isActive: vi.fn().mockResolvedValue(false) } as never,
    );
    await expect(
      guard.canActivate(
        authContext({ headers: { authorization: 'Bearer token' } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});

describe('STEP 282 — expired session', () => {
  it('checks expiry and revocation in the Prisma session repository', async () => {
    type Query = {
      where: {
        user: { uuid: string };
        sessionId: string;
        revokedAt: null;
        expiresAt: { gt: Date };
      };
    };
    let received: Query | undefined;
    const findFirst = vi.fn(async (args: Query) => {
      received = args;
      return null;
    });
    const repo = new PrismaAuthenticationSessionRepository({
      authenticationUserSession: { findFirst },
    } as never);
    await expect(repo.isActive(USER_A, 'secret', new Date())).resolves.toBe(
      false,
    );
    expect(received?.where.revokedAt).toBeNull();
    expect(received?.where.expiresAt.gt).toBeInstanceOf(Date);
  });
});

describe('STEP 283 — IDOR', () => {
  it('denies cross-user profile access without administrative permission', () => {
    const policy = new UserProfileOwnershipPolicy();
    expect(() =>
      policy.assertCanManage({ sub: USER_A, permissions: [] }, USER_B),
    ).toThrow();
    expect(() =>
      policy.assertCanManage(
        { sub: USER_A, permissions: ['users:manage'] },
        USER_B,
      ),
    ).not.toThrow();
  });
});

describe('STEP 284 — privilege escalation', () => {
  it('denies role management to a read-only principal', () => {
    expect(() =>
      new RoleAuthorizationPolicy().canManage({
        userUuid: USER_A,
        permissions: ['roles:read'],
      }),
    ).toThrow(ForbiddenException);
  });
});

describe('STEP 285 — role escalation', () => {
  it('requires an explicit protected-role permission for protected roles', () => {
    const policy = new RoleAuthorizationPolicy();
    expect(() =>
      policy.canManage(
        { userUuid: USER_A, permissions: ['roles:manage'] },
        true,
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      policy.canManage(
        {
          userUuid: USER_A,
          permissions: ['roles:manage', 'roles:manage:protected'],
        },
        true,
      ),
    ).not.toThrow();
  });
});

describe('STEP 286 — permission escalation', () => {
  it('uses authoritative permissions instead of spoofed request permissions', async () => {
    const repository = {
      getAuthorizationSnapshot: vi.fn().mockResolvedValue({
        userUuid: USER_A,
        permissionCodes: ['users:read'],
        roleCodes: ['user'],
      }),
    };
    const guard = new PermissionManageAccessGuard(repository as never);
    const request = {
      user: { sub: USER_A, permissions: ['permissions:manage'] },
    };
    await expect(guard.canActivate(authContext(request))).rejects.toThrow(
      ForbiddenException,
    );
    expect(request.user.permissions).toEqual(['users:read']);
  });
});

describe('STEP 287 — OTP brute force', () => {
  it('keeps OTP verification on a bounded server-side rate policy', () => {
    expect(TWO_FACTOR_VERIFICATION_RATE_LIMIT.limit).toBeLessThanOrEqual(10);
    expect(TWO_FACTOR_VERIFICATION_RATE_LIMIT.ttl).toBe(60000);
  });
});

describe('STEP 288 — recovery code abuse', () => {
  it('requires a bounded verification policy for recovery authentication', () => {
    expect(TWO_FACTOR_VERIFICATION_RATE_LIMIT.limit).toBeGreaterThan(0);
    expect(TWO_FACTOR_VERIFICATION_RATE_LIMIT.ttl).toBeGreaterThan(0);
  });
});

describe('STEP 289 — SQL injection', () => {
  it('passes hostile search input as a bound Prisma value', async () => {
    type Query = { where: { email: string; deletedAt: null } };
    let received: Query | undefined;
    const findFirst = vi.fn(async (args: Query) => {
      received = args;
      return null;
    });
    const repo = new PrismaUserRepository({
      authenticationUser: { findFirst },
    } as never);
    const payload = "' OR 1=1 --";
    await expect(repo.findByEmail(payload)).resolves.toBeNull();
    expect(received).toEqual({ where: { email: payload, deletedAt: null } });
  });
});

describe('STEP 290 — XSS payload', () => {
  it('keeps script input as JSON data instead of an executable response', () => {
    const payload = '<script>alert(1)</script>';
    const response = serializeUser({
      uuid: USER_A,
      username: payload,
      email: null,
      phone: null,
      status: 'active',
      isActive: true,
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    const body = JSON.stringify(response);
    expect(body).toContain(payload);
    expect(body.trimStart().startsWith('<script>')).toBe(false);
  });
});

describe('STEP 291 — mass assignment', () => {
  it('rejects protected fields added to an update payload', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });
    await expect(
      pipe.transform(
        {
          username: 'safe',
          role: 'admin',
          permissions: ['*'],
          passwordHash: 'secret',
          isAdmin: true,
        },
        { type: 'body', metatype: UpdateUserDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('STEP 292 — prototype pollution', () => {
  it('rejects prototype-pollution-style properties without mutating Object.prototype', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });
    const payload = JSON.parse(
      '{"username":"safe","__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}}}',
    ) as object;
    await expect(
      pipe.transform(payload, { type: 'body', metatype: UpdateUserDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(Object.prototype).not.toHaveProperty('polluted');
  });
});

describe('STEP 293 — security headers', () => {
  it('keeps the API security header policy explicit', () => {
    const security = securityConfig();
    expect(security.helmet.noSniff).toBe(true);
    expect(security.helmet.frameguard).toEqual({ action: 'deny' });
    expect(security.helmet.referrerPolicy).toEqual({ policy: 'no-referrer' });
  });
});

describe('STEP 294 — rate-limit bypass', () => {
  it('has an explicit login throttle and non-zero bounded policy', () => {
    expect(
      Reflect.getMetadataKeys(AuthController.prototype, 'loginUser'),
    ).not.toHaveLength(0);
    expect(LOGIN_RATE_LIMIT.limit).toBeGreaterThan(0);
    expect(LOGIN_RATE_LIMIT.ttl).toBeGreaterThan(0);
  });
});

describe('STEP 295 — sensitive-data leak', () => {
  it('redacts security material at the audit and logging boundaries', () => {
    const changes = sanitizeAuditChanges('authentication', [
      { field: 'password', oldValue: 'x', newValue: 'y' },
      { field: 'accessToken', oldValue: 'x', newValue: 'y' },
      { field: 'refreshToken', oldValue: 'x', newValue: 'y' },
      { field: 'twoFactorSecret', oldValue: 'x', newValue: 'y' },
      { field: 'sessionSecret', oldValue: 'x', newValue: 'y' },
      { field: 'reason', oldValue: null, newValue: 'NORMAL' },
    ]);
    expect(changes).toEqual([
      { field: 'reason', oldValue: null, newValue: 'NORMAL' },
    ]);
    expect(sanitizeAuditReason('password=secret')).toBeNull();
    expect(SENSITIVE_LOG_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.token',
        'req.body.secret',
      ]),
    );
  });
});
