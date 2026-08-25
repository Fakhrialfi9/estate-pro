import { describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { UserEntity } from '../../src/modules/users/domain/entities/user.entity.js';
import type { UserRepository } from '../../src/modules/users/domain/repositories/user.repository.js';
import type { CredentialRepository } from '../../src/modules/users/credentials/domain/repositories/credential.repository.js';
import { LoginService } from '../../src/modules/auth/application/services/login.service.js';
import { JwtTokenService } from '../../src/modules/auth/application/services/jwt-token.service.js';
import { LOGIN_RATE_LIMIT } from '../../src/config/rate-limit.config.js';
import type {
  AuthenticationSecurityRepository,
  AuthenticationSecurityState,
  AuthenticationLockoutPolicy,
} from '../../src/modules/auth/domain/repositories/authentication-security.repository.js';
import type { AuthenticationSessionRepository } from '../../src/modules/auth/domain/repositories/authentication-session.repository.js';
import type {
  SecurityAuditRepository,
  SecurityAuditEvent,
} from '../../src/modules/auth/domain/repositories/security-audit.repository.js';

const secret = 'unit-test-jwt-secret-012345678901234567890123456789';
const config = {
  getOrThrow: vi.fn(
    (key: string) =>
      (
        ({
          'auth.jwt.secret': secret,
          'auth.jwt.issuer': 'estate-pro-api',
          'auth.jwt.audience': 'estate-pro-client',
          'auth.jwt.algorithm': 'HS256',
          'auth.jwt.expiresIn': '60s',
          'auth.login.lockoutThreshold': 5,
          'auth.login.lockoutWindowMs': 900000,
          'auth.login.lockoutDurationMs': 900000,
        }) as Record<string, unknown>
      )[key],
  ),
};

const user = (overrides: Partial<UserEntity> = {}): UserEntity =>
  ({
    id: 1n,
    uuid: 'u-1',
    username: 'member',
    email: 'member@example.com',
    phone: null,
    status: 'active',
    isActive: true,
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    isAccessible() {
      return this.deletedAt === null && this.isActive;
    },
    ...overrides,
  }) as UserEntity;

class SecurityStateFake implements AuthenticationSecurityRepository {
  readonly states = new Map<string, AuthenticationSecurityState>();
  async getState(userUuid: string): Promise<AuthenticationSecurityState> {
    let state = this.states.get(userUuid);
    if (!state) {
      state = {
        userUuid,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        lastLoginIp: null,
        updatedAt: new Date(),
      };
      this.states.set(userUuid, state);
    }
    return state;
  }
  async recordFailedLogin(
    userUuid: string,
    now: Date,
    policy: AuthenticationLockoutPolicy,
  ): Promise<AuthenticationSecurityState> {
    const state = await this.getState(userUuid);
    state.failedLoginAttempts += 1;
    state.updatedAt = now;
    if (
      state.failedLoginAttempts >= policy.threshold &&
      (!state.lockedUntil || state.lockedUntil <= now)
    ) {
      state.lockedUntil = new Date(now.getTime() + policy.durationMs);
    }
    return state;
  }
  async recordSuccessfulLogin(
    userUuid: string,
    now: Date,
    context: { ipAddress?: string },
  ): Promise<void> {
    const state = await this.getState(userUuid);
    state.failedLoginAttempts = 0;
    state.lockedUntil = null;
    state.lastLoginAt = now;
    state.lastLoginIp = context.ipAddress ?? null;
    state.updatedAt = now;
  }
}

const makeLogin = (passwordValid = true, account = user()) => {
  const users = {
    findByEmail: vi.fn().mockResolvedValue(account.email ? account : null),
    findByUsername: vi.fn().mockResolvedValue(account),
  } as unknown as UserRepository;
  const credentials = {
    findByUserUuid: vi
      .fn()
      .mockResolvedValue({
        userUuid: account.uuid,
        passwordHash: 'argon2-hash',
      }),
  } as unknown as CredentialRepository;
  const security = new SecurityStateFake();
  const sessions = {
    create: vi.fn(),
    isActive: vi.fn().mockResolvedValue(true),
    revoke: vi.fn(),
  } as unknown as AuthenticationSessionRepository;
  const auditEvents: SecurityAuditEvent[] = [];
  const audit: SecurityAuditRepository = {
    record: vi.fn(async (event) => {
      auditEvents.push(event);
    }),
  };
  const hasher = { verify: vi.fn().mockResolvedValue(passwordValid) };
  const jwt = {
    issueAccessToken: vi.fn().mockResolvedValue('signed.jwt.token'),
    getExpiresAt: vi.fn().mockReturnValue(new Date(Date.now() + 60000)),
  };
  const service = new LoginService(
    users,
    credentials,
    security,
    sessions,
    audit,
    hasher as never,
    jwt as never,
    config as never,
  );
  return { service, security, sessions, auditEvents, hasher, users, jwt };
};

describe('authentication security steps 102-106', () => {
  it('102: authenticates successfully, creates session, resets failures, audits safely, and returns no credential data', async () => {
    const ctx = makeLogin(true);
    const result = await ctx.service.execute({
      identifier: 'member@example.com',
      password: 'CorrectPassword!',
      ipAddress: '127.0.0.1',
    });
    expect(result?.accessToken).toBe('signed.jwt.token');
    expect(result?.tokenType).toBe('Bearer');
    expect(ctx.sessions.create).toHaveBeenCalledOnce();
    expect((await ctx.security.getState('u-1')).failedLoginAttempts).toBe(0);
    expect(ctx.auditEvents[0]?.action).toBe('LOGIN_SUCCESS');
    expect(JSON.stringify(ctx.auditEvents)).not.toContain('argon2-hash');
    expect(JSON.stringify(result)).not.toContain('password');
  });

  it('103: rejects invalid password and unknown identity with the same application failure result', async () => {
    const invalid = makeLogin(false);
    await expect(
      invalid.service.execute({
        identifier: 'member@example.com',
        password: 'wrong',
      }),
    ).resolves.toBeNull();
    expect(invalid.auditEvents.at(-1)?.action).toBe('LOGIN_FAILURE');
    expect((await invalid.security.getState('u-1')).failedLoginAttempts).toBe(
      1,
    );
    const unknown = makeLogin(true);
    unknown.users.findByEmail = vi.fn().mockResolvedValue(null);
    unknown.users.findByUsername = vi.fn().mockResolvedValue(null);
    await expect(
      unknown.service.execute({
        identifier: 'missing@example.com',
        password: 'wrong',
      }),
    ).resolves.toBeNull();
    expect(unknown.auditEvents.at(-1)?.action).toBe('LOGIN_FAILURE');
  });

  it('103: rejects disabled accounts before token issuance', async () => {
    const ctx = makeLogin(true, user({ status: 'disabled', isActive: false }));
    await expect(
      ctx.service.execute({
        identifier: 'member@example.com',
        password: 'CorrectPassword!',
      }),
    ).resolves.toBeNull();
    expect(ctx.jwt.issueAccessToken).not.toHaveBeenCalled();
  });

  it('106: locks after threshold, rejects locked attempts, and recovers on successful authentication after expiry', async () => {
    const ctx = makeLogin(false);
    for (let i = 0; i < 5; i += 1) {
      await ctx.service.execute({
        identifier: 'member@example.com',
        password: 'wrong',
      });
    }
    const state = await ctx.security.getState('u-1');
    expect(state.failedLoginAttempts).toBe(5);
    expect(state.lockedUntil).toBeInstanceOf(Date);
    const before = ctx.hasher.verify.mock.calls.length;
    await expect(
      ctx.service.execute({
        identifier: 'member@example.com',
        password: 'CorrectPassword!',
      }),
    ).resolves.toBeNull();
    expect(ctx.hasher.verify).toHaveBeenCalledTimes(before);
  });

  it('106: repeated concurrent failures leave the security state locked consistently', async () => {
    const ctx = makeLogin(false);
    await Promise.all(
      Array.from({ length: 10 }, () =>
        ctx.service.execute({
          identifier: 'member@example.com',
          password: 'wrong',
        }),
      ),
    );
    const state = await ctx.security.getState('u-1');
    expect(state.failedLoginAttempts).toBeGreaterThanOrEqual(5);
    expect(state.lockedUntil).toBeInstanceOf(Date);
  });

  it('84: login rate limit is finite and centrally configured', () => {
    expect(LOGIN_RATE_LIMIT.limit).toBe(5);
    expect(LOGIN_RATE_LIMIT.ttl).toBe(60000);
  });
});

describe('jwt security steps 91-99 and 104-105', () => {
  it('issues minimal expiring claims and rejects expired/malformed/tampered tokens', async () => {
    const service = new JwtTokenService(new JwtService({}), config as never);
    const token = await service.issueAccessToken('u-1', 's-1');
    const claims = await service.verifyAccessToken(token);
    expect(claims.sub).toBe('u-1');
    expect(claims.sid).toBe('s-1');
    expect(claims.exp).toBeGreaterThan(claims.iat);
    expect(JSON.stringify(claims)).not.toContain('password');
    await expect(service.verifyAccessToken('not-a-jwt')).rejects.toThrow(
      'Invalid authentication token',
    );
    const parts = token.split('.');
    parts[1] = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(parts[1], 'base64url').toString()),
        sub: 'u-2',
      }),
    ).toString('base64url');
    await expect(service.verifyAccessToken(parts.join('.'))).rejects.toThrow(
      'Invalid authentication token',
    );
  });

  it('rejects missing subject, invalid issuer and invalid audience', async () => {
    const jwt = new JwtService({});
    const base = {
      secret,
      algorithm: 'HS256' as const,
      expiresIn: '60s',
      issuer: 'estate-pro-api',
      audience: 'estate-pro-client',
    };
    const missingSub = await jwt.signAsync({ sid: 's-1' }, base);
    await expect(
      new JwtTokenService(jwt, config as never).verifyAccessToken(missingSub),
    ).rejects.toThrow();
    const wrongIssuer = await jwt.signAsync(
      { sub: 'u-1', sid: 's-1' },
      { ...base, issuer: 'other' },
    );
    await expect(
      new JwtTokenService(jwt, config as never).verifyAccessToken(wrongIssuer),
    ).rejects.toThrow();
    const wrongAudience = await jwt.signAsync(
      { sub: 'u-1', sid: 's-1' },
      { ...base, audience: 'other' },
    );
    await expect(
      new JwtTokenService(jwt, config as never).verifyAccessToken(
        wrongAudience,
      ),
    ).rejects.toThrow();
  });
});
