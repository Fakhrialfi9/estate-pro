import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import {
  normalizeAuditResourceType,
  sanitizeAuditChanges,
  sanitizeAuditReason,
  sanitizeAuditRequestId,
  sanitizeAuditUserAgent,
} from '../../src/common/audit/audit-redaction.js';
import {
  sanitizeSystemCorrelationContext,
  type SystemCorrelationContext,
} from '../../src/common/observability/system-context.js';
import { AuthenticatedAccessGuard } from '../../src/common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../src/common/security/authorization.guard.js';
import { PropertyAccessGuard } from '../../src/common/security/property-access.guard.js';
import { ClosurePolicy } from '../../src/modules/crm/domain/closure.policy.js';
import { DuplicateDetector } from '../../src/modules/crm/application/ports/duplicate-detector.js';
import { LeadMergePolicy } from '../../src/modules/crm/application/ports/merge.policy.js';
import { LeadLifecyclePolicy } from '../../src/modules/crm/domain/lead-lifecycle.policy.js';
import {
  allowedTransitions,
  canTransition,
} from '../../src/modules/crm/domain/lifecycle.policy.js';
import { QualificationPolicy } from '../../src/modules/crm/domain/qualification.policy.js';
import {
  AnalyticsInvalidQueryException,
  AnalyticsQueryTimeoutException,
  AnalyticsScopeException,
  AnalyticsUnavailableException,
} from '../../src/modules/analytics/domain/errors/analytics.errors.js';
import { RefreshTokenEntity } from '../../src/modules/auth/domain/entities/refresh-token.entity.js';
import { RefreshTokenFamilyEntity } from '../../src/modules/auth/domain/entities/refresh-token-family.entity.js';
import { TwoFactorEntity } from '../../src/modules/auth/domain/entities/two-factor.entity.js';

const uuid = '123e4567-e89b-12d3-a456-426614174000';
const now = new Date('2026-01-01T00:00:00.000Z');

type RequestLike = {
  headers: Record<string, string | undefined>;
  user?: {
    sub?: string;
    sid?: string;
    permissions?: readonly string[];
    [key: string]: unknown;
  };
  params: Record<string, string | undefined>;
  method?: string;
  path?: string;
};

const contextOf = (request: RequestLike): ExecutionContext => {
  const context = {
    switchToHttp: () => ({
      getRequest: <T>() => request as T,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
  return context as unknown as ExecutionContext;
};

const actorClaims = {
  sub: uuid,
  sid: '42',
  iat: 1_700_000_000,
  exp: 1_700_000_900,
  jti: 'jti-1',
};

describe('roadmap common security and observability coverage', () => {
  it('covers correlation context sanitization', () => {
    expect(sanitizeSystemCorrelationContext({})).toEqual({});
    const input: SystemCorrelationContext = {
      requestId: 'r'.repeat(150),
      correlationId: 'c'.repeat(150),
      eventId: 'e'.repeat(150),
      jobId: 'j'.repeat(150),
      providerId: 'p'.repeat(150),
    };
    const result = sanitizeSystemCorrelationContext(input);
    expect(result.requestId).toHaveLength(120);
    expect(result.correlationId).toHaveLength(120);
    expect(result.eventId).toHaveLength(120);
    expect(result.jobId).toHaveLength(120);
    expect(result.providerId).toHaveLength(120);
    expect(
      sanitizeSystemCorrelationContext({
        requestId: '',
        correlationId: '',
        eventId: '',
        jobId: '',
        providerId: '',
      }),
    ).toEqual({});
  });

  it('covers authenticated access guard outcomes', async () => {
    const verifier = {
      verifyAccessToken: vi.fn().mockResolvedValue(actorClaims),
    };
    const sessions = { isActive: vi.fn().mockResolvedValue(true) };
    const guard = new AuthenticatedAccessGuard(
      verifier as never,
      sessions as never,
    );

    await expect(
      guard.canActivate(contextOf({ headers: {}, params: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      guard.canActivate(
        contextOf({
          headers: { authorization: 'Basic x' },
          params: {},
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      guard.canActivate(
        contextOf({
          headers: { authorization: 'Bearer ' },
          params: {},
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const request: RequestLike = {
      headers: { authorization: 'Bearer token' },
      params: {},
    };
    await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);
    expect(request.user).toEqual(actorClaims);

    sessions.isActive.mockResolvedValueOnce(false);
    await expect(guard.canActivate(contextOf(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    verifier.verifyAccessToken.mockRejectedValueOnce(new Error('bad token'));
    await expect(guard.canActivate(contextOf(request))).rejects.toThrow(
      'Invalid authentication token',
    );
  });

  it('covers authorization guard metadata and property access decisions', async () => {
    const reflector = new Reflector();
    const authorization = {
      resolve: vi.fn().mockResolvedValue({
        userUuid: uuid,
        permissionCodes: ['properties.manage'],
        roleCodes: ['admin'],
      }),
      assertPermissions: vi.fn(),
      assertRoles: vi.fn(),
    };
    const propertyAccess = { canActivate: vi.fn().mockResolvedValue(true) };
    const publicGuard = new AuthorizationGuard(
      { getAllAndOverride: vi.fn().mockReturnValue(true) } as never,
      authorization as never,
      propertyAccess as never,
    );
    await expect(
      publicGuard.canActivate(contextOf({ headers: {}, params: {} })),
    ).resolves.toBe(true);

    const emptyGuard = new AuthorizationGuard(
      { getAllAndOverride: vi.fn().mockReturnValue(undefined) } as never,
      authorization as never,
      propertyAccess as never,
    );
    await expect(
      emptyGuard.canActivate(contextOf({ headers: {}, params: {} })),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const permissionReflector = {
      getAllAndOverride: vi.fn((key: unknown) =>
        String(key).includes('permissions')
          ? { values: ['properties.read'], match: 'ALL' }
          : undefined,
      ),
    };
    const request: RequestLike = {
      headers: {},
      params: {},
      user: { ...actorClaims },
    };
    const permissionGuard = new AuthorizationGuard(
      permissionReflector as never,
      authorization as never,
      propertyAccess as never,
    );
    await expect(
      permissionGuard.canActivate(contextOf(request)),
    ).resolves.toBe(true);
    expect(request.user?.permissions).toContain('properties.manage');
  });

  it('covers object-level property access paths', async () => {
    const query = {
      canAccessListing: vi.fn().mockResolvedValue(true),
      canAccessProperty: vi.fn().mockResolvedValue(true),
    };
    const guard = new PropertyAccessGuard(query as never);

    await expect(
      guard.canActivate(
        contextOf({
          headers: {},
          params: {},
          user: { sub: uuid },
          path: '/api/v1/health',
        }),
      ),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(
        contextOf({
          headers: {},
          params: { uuid: 'listing-1' },
          user: { sub: uuid },
          path: '/api/v1/listings/:uuid',
        }),
      ),
    ).resolves.toBe(true);
    query.canAccessListing.mockResolvedValueOnce(false);
    await expect(
      guard.canActivate(
        contextOf({
          headers: {},
          params: { uuid: 'listing-1' },
          user: { sub: uuid },
          path: '/api/v1/listings/:uuid',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      guard.canActivate(
        contextOf({
          headers: {},
          params: {},
          user: { sub: uuid, permissions: ['properties.manage'] },
          path: '/api/v1/properties/property-1',
        }),
      ),
    ).resolves.toBe(true);
  });

  it('covers audit redaction branches', () => {
    expect(normalizeAuditResourceType()).toBeNull();
    expect(normalizeAuditResourceType('Authentication')).toBe(
      'authentication',
    );
    expect(normalizeAuditResourceType(' weird value ')).toBe('weird_value');
    expect(sanitizeAuditReason()).toBeNull();
    expect(sanitizeAuditReason(' ')).toBeNull();
    expect(sanitizeAuditReason('LOGIN_SUCCESS')).toBe('LOGIN_SUCCESS');
    expect(sanitizeAuditReason('contains password')).toBeNull();
    expect(sanitizeAuditUserAgent()).toBeNull();
    expect(sanitizeAuditUserAgent('abcdef', 3)).toBe('abc');
    expect(sanitizeAuditRequestId()).toBeNull();
    expect(sanitizeAuditRequestId('bad id')).toBeNull();
    expect(sanitizeAuditRequestId('request-1_2')).toBe('request-1_2');
    expect(
      sanitizeAuditChanges('user', [
        { field: 'email', oldValue: 'a', newValue: 'b' },
        { field: 'password', oldValue: 'a', newValue: 'b' },
      ]),
    ).toEqual([{ field: 'email', oldValue: 'a', newValue: 'b' }]);
  });

  it('covers analytics error constructors', () => {
    expect(new AnalyticsInvalidQueryException().getStatus()).toBe(400);
    expect(
      new AnalyticsInvalidQueryException('custom').getResponse(),
    ).toMatchObject({
      code: 'ANALYTICS_INVALID_QUERY',
      message: 'custom',
    });
    expect(new AnalyticsScopeException().getStatus()).toBe(403);
    expect(new AnalyticsQueryTimeoutException().getStatus()).toBe(504);
    expect(new AnalyticsUnavailableException().getStatus()).toBe(503);
  });

  it('covers CRM policy branches', () => {
    const closure = new ClosurePolicy();
    expect(closure.decide(' sold ', 'WON')).toEqual({
      reason: 'sold',
      outcome: 'WON',
    });
    expect(() => closure.decide(' ', 'LOST')).toThrow();

    const qualification = new QualificationPolicy();
    expect(qualification.evaluate(10, 'qualified')).toMatchObject({
      qualified: true,
    });
    expect(qualification.evaluate(0, 'not qualified')).toMatchObject({
      qualified: false,
    });

    const lifecycle = new LeadLifecyclePolicy();
    lifecycle.assertCan('QUALIFY', 'NEW');
    expect(() => lifecycle.assertCan('QUALIFY', 'CLOSED_WON')).toThrow();
    expect(canTransition('NEW', 'CONTACTED')).toBe(true);
    expect(canTransition('NEW', 'CLOSED_WON')).toBe(false);
    expect(allowedTransitions('NURTURING')).toContain('QUALIFIED');

    const merge = new LeadMergePolicy();
    expect(() => merge.assertAllowed('a', 'b', false)).toThrow();
    expect(() => merge.assertAllowed('a', 'a', true)).toThrow();
    expect(() => merge.assertAllowed('a', 'b', true)).not.toThrow();

    const detector = new DuplicateDetector();
    const matches = detector.detect(
      {
        leadUuid: 'a',
        email: 'a@example.com',
        phone: '+62 812123',
        displayName: 'Alice',
      },
      [
        {
          leadUuid: 'b',
          email: 'a@example.com',
          phone: '+62 812123',
          displayName: 'Alice',
        },
      ],
    );
    expect(matches).toHaveLength(1);
  });

  it('covers refresh token family and two-factor state', () => {
    const token = RefreshTokenEntity.create({
      id: 'token-1',
      familyId: uuid,
      userUuid: uuid,
      sessionId: '42',
      tokenHash: 'a'.repeat(64),
      issuedAt: now,
      expiresAt: new Date('2026-01-02T00:00:00.000Z'),
      consumedAt: null,
      revokedAt: null,
      revokeReason: null,
    });
    expect(token.state(now)).toBe('ACTIVE');
    expect(() => token.assertRefreshable(now)).not.toThrow();

    const family = RefreshTokenFamilyEntity.create({
      id: uuid,
      userUuid: uuid,
      sessionId: '42',
      revokedAt: null,
      revokeReason: null,
      createdAt: now,
      updatedAt: now,
    });
    expect(family.isActive()).toBe(true);
    expect(
      RefreshTokenFamilyEntity.create({
        id: uuid,
        userUuid: uuid,
        sessionId: '42',
        revokedAt: now,
        revokeReason: 'LOGOUT',
        createdAt: now,
        updatedAt: now,
      }).status(),
    ).toBe('revoked');

    const twoFactor = TwoFactorEntity.create({
      id: 1n,
      userUuid: uuid,
      method: 'totp',
      secretEncrypted: 'secret',
      enabledAt: null,
      failedVerificationAttempts: 1,
      lockedUntil: new Date('2026-01-01T00:05:00Z'),
      createdAt: now,
      updatedAt: now,
    });
    expect(twoFactor.status).toBe('PENDING');
  });
});
