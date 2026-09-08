import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import {
  sanitizeSystemCorrelationContext,
  type SystemCorrelationContext,
} from '../../src/common/observability/system-context.js';
import { AuthenticatedAccessGuard } from '../../src/common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../src/common/security/authorization.guard.js';
import { PropertyAccessGuard } from '../../src/common/security/property-access.guard.js';
import { sanitizeAuditChanges, sanitizeAuditReason, sanitizeAuditRequestId, sanitizeAuditUserAgent, normalizeAuditResourceType } from '../../src/common/audit/audit-redaction.js';
import { ClosurePolicy } from '../../src/modules/crm/domain/closure.policy.js';
import { LeadLifecyclePolicy } from '../../src/modules/crm/domain/lead-lifecycle.policy.js';
import { allowedTransitions, canTransition } from '../../src/modules/crm/domain/lifecycle.policy.js';
import { QualificationPolicy } from '../../src/modules/crm/domain/qualification.policy.js';
import { DuplicateDetector } from '../../src/modules/crm/application/ports/duplicate-detector.js';
import { LeadMergePolicy } from '../../src/modules/crm/application/ports/merge.policy.js';
import { AnalyticsInvalidQueryException, AnalyticsQueryTimeoutException, AnalyticsScopeException, AnalyticsUnavailableException } from '../../src/modules/analytics/domain/errors/analytics.errors.js';
import { RefreshTokenEntity } from '../../src/modules/auth/domain/entities/refresh-token.entity.js';
import { RefreshTokenFamilyEntity } from '../../src/modules/auth/domain/entities/refresh-token-family.entity.js';
import { TwoFactorEntity } from '../../src/modules/auth/domain/entities/two-factor.entity.js';
import { RolePermissionEntity } from '../../src/modules/roles/domain/entities/role-permission.entity.js';

const uuid = '123e4567-e89b-12d3-a456-426614174000';
const now = new Date('2026-01-01T00:00:00.000Z');

type RequestLike = {
  headers: Record<string, string | undefined>;
  user?: { sub?: string; sid?: string; permissions?: readonly string[]; [key: string]: unknown };
  params: Record<string, string | undefined>;
  method?: string;
  path?: string;
  originalUrl?: string;
  url?: string;
  route?: { path?: string };
};

type ContextLike = {
  switchToHttp: () => { getRequest: <T>() => T };
  getHandler: () => object;
  getClass: () => object;
};

const contextOf = (request: RequestLike, handler: object = {}, target: object = {}): ExecutionContext => {
  const context: ContextLike = {
    switchToHttp: () => ({ getRequest: <T>() => request as T }),
    getHandler: () => handler,
    getClass: () => target,
  };
  return context as unknown as ExecutionContext;
};

const actorClaims = { sub: uuid, sid: '42', iat: 1_700_000_000, exp: 1_700_000_900, jti: 'jti-1' };

describe('roadmap coverage: common guards and sanitizers', () => {
  it('covers system correlation context presence and absence', () => {
    expect(sanitizeSystemCorrelationContext({})).toEqual({});
    const context: SystemCorrelationContext = {
      requestId: 'r'.repeat(150),
      correlationId: 'c'.repeat(150),
      eventId: 'e'.repeat(150),
      jobId: 'j'.repeat(150),
      providerId: 'p'.repeat(150),
    };
    const result = sanitizeSystemCorrelationContext(context);
    expect(result.requestId).toHaveLength(120);
    expect(result.correlationId).toHaveLength(120);
    expect(result.eventId).toHaveLength(120);
    expect(result.jobId).toHaveLength(120);
    expect(result.providerId).toHaveLength(120);
    expect(sanitizeSystemCorrelationContext({ requestId: '', correlationId: '', eventId: '', jobId: '', providerId: '' })).toEqual({});
  });

  it('covers authenticated access missing, invalid and active principals', async () => {
    const verifier = { verifyAccessToken: vi.fn().mockResolvedValue(actorClaims) };
    const sessions = { isActive: vi.fn().mockResolvedValue(true) };
    const guard = new AuthenticatedAccessGuard(verifier as never, sessions as never);

    await expect(guard.canActivate(contextOf({ headers: {}, params: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(contextOf({ headers: { authorization: 'Basic x' }, params: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(contextOf({ headers: { authorization: 'Bearer ' }, params: {} }))).rejects.toBeInstanceOf(UnauthorizedException);

    const request: RequestLike = { headers: { authorization: 'Bearer token' }, params: {} };
    await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);
    expect(request.user).toEqual(actorClaims);
    sessions.isActive.mockResolvedValueOnce(false);
    await expect(guard.canActivate(contextOf({ headers: { authorization: 'Bearer token' }, params: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
    verifier.verifyAccessToken.mockRejectedValueOnce(new Error('bad token'));
    await expect(guard.canActivate(contextOf({ headers: { authorization: 'Bearer token' }, params: {} }))).rejects.toThrow('Invalid authentication token');
    verifier.verifyAccessToken.mockRejectedValueOnce(new UnauthorizedException());
    await expect(guard.canActivate(contextOf({ headers: { authorization: 'Bearer token' }, params: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('covers authorization metadata, authentication and property boundary branches', async () => {
    const reflector = new Reflector();
    const authorization = {
      resolve: vi.fn().mockResolvedValue({ userUuid: uuid, permissionCodes: ['properties.manage'], roleCodes: ['admin'] }),
      assertPermissions: vi.fn(),
      assertRoles: vi.fn(),
    };
    const propertyAccess = { canActivate: vi.fn().mockResolvedValue(true) };
    const guard = new AuthorizationGuard(reflector, authorization as never, propertyAccess as never);

    const publicReflector = { getAllAndOverride: vi.fn((key: unknown) => String(key).includes('public')) };
    const publicGuard = new AuthorizationGuard(publicReflector as never, authorization as never, propertyAccess as never);
    expect(await publicGuard.canActivate(contextOf({ headers: {}, params: {} }))).toBe(true);

    const noMetadataReflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) };
    const noMetadataGuard = new AuthorizationGuard(noMetadataReflector as never, authorization as never, propertyAccess as never);
    await expect(noMetadataGuard.canActivate(contextOf({ headers: {}, params: {} }))).rejects.toBeInstanceOf(ForbiddenException);

    const permissionReflector = { getAllAndOverride: vi.fn((key: unknown) => String(key).includes('permissions') ? { values: ['properties.read'], match: 'ALL' } : undefined) };
    const permissionGuard = new AuthorizationGuard(permissionReflector as never, authorization as never, propertyAccess as never);
    const request: RequestLike = { headers: {}, params: {}, user: { ...actorClaims } };
    await expect(permissionGuard.canActivate(contextOf(request))).resolves.toBe(true);
    expect(request.user?.permissions).toContain('properties.manage');
    await expect(noMetadataGuard.canActivate(contextOf({ headers: {}, params: {}, user: { ...actorClaims } }))).rejects.toBeInstanceOf(ForbiddenException);

    const unauthReflector = { getAllAndOverride: vi.fn((key: unknown) => String(key).includes('permissions') ? { values: ['properties.read'], match: 'ALL' } : undefined) };
    const unauthGuard = new AuthorizationGuard(unauthReflector as never, authorization as never, propertyAccess as never);
    await expect(unauthGuard.canActivate(contextOf({ headers: {}, params: {} }))).rejects.toBeInstanceOf(UnauthorizedException);

    authorization.resolve.mockRejectedValueOnce(new Error('resolver failure'));
    await expect(unauthGuard.canActivate(contextOf({ headers: {}, params: {}, user: { ...actorClaims } }))).rejects.toBeInstanceOf(ForbiddenException);

    const propertyQuery = {
      canAccessListing: vi.fn().mockResolvedValue(true),
      canAccessProperty: vi.fn().mockResolvedValue(true),
    };
    const propertyGuard = new PropertyAccessGuard(propertyQuery as never);
    await expect(propertyGuard.canActivate(contextOf({ headers: {}, params: {}, user: { sub: uuid }, path: '/api/v1/health' }))).resolves.toBe(true);
    await expect(propertyGuard.canActivate(contextOf({ headers: {}, params: {}, user: {}, path: '/api/v1/properties/p1' }))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(propertyGuard.canActivate(contextOf({ headers: {}, params: {}, user: { sub: uuid }, permissions: [] as never, path: '/api/v1/listings/l1' }))).rejects.toBeInstanceOf(ForbiddenException);
    const listingRequest: RequestLike = { headers: {}, params: { uuid: 'listing-1' }, user: { sub: uuid, permissions: [] }, path: '/api/v1/listings/:uuid' };
    await expect(propertyGuard.canActivate(contextOf(listingRequest))).resolves.toBe(true);
    const propertyRequest: RequestLike = { headers: {}, params: { propertyUuid: 'property-1' }, user: { sub: uuid, permissions: [] }, method: 'GET', path: '/api/v1/properties/:propertyUuid' };
    await expect(propertyGuard.canActivate(contextOf(propertyRequest))).resolves.toBe(true);
    propertyQuery.canAccessProperty.mockResolvedValueOnce(false);
    await expect(propertyGuard.canActivate(contextOf(propertyRequest))).rejects.toBeInstanceOf(ForbiddenException);
    propertyQuery.canAccessListing.mockResolvedValueOnce(false);
    await expect(propertyGuard.canActivate(contextOf(listingRequest))).rejects.toBeInstanceOf(ForbiddenException);
    const globalAccess: RequestLike = { headers: {}, params: {}, user: { sub: uuid, permissions: ['listings:manage'] }, path: '/api/v1/listings/list-1' };
    await expect(propertyGuard.canActivate(contextOf(globalAccess))).resolves.toBe(true);
    const restore: RequestLike = { headers: {}, params: { uuid: 'property-2' }, user: { sub: uuid, permissions: [] }, method: 'POST', path: '/api/v1/properties/property-2/restore' };
    await expect(propertyGuard.canActivate(contextOf(restore))).resolves.toBe(true);
  });

  it('covers audit redaction and normalization branches', () => {
    expect(normalizeAuditResourceType()).toBeNull();
    expect(normalizeAuditResourceType('Authentication')).toBe('authentication');
    expect(normalizeAuditResourceType(' weird value ')).toBe('weird_value');
    const changes = sanitizeAuditChanges('user', [
      { field: 'email', oldValue: 'a', newValue: 'b' },
      { field: 'password', oldValue: 'a', newValue: 'b' },
      { field: 'unknown', oldValue: 'a', newValue: 'b' },
      { field: '', oldValue: 'a', newValue: 'b' },
      { field: 'status', oldValue: { secret: true }, newValue: Number.NaN },
    ]);
    expect(changes).toEqual([{ field: 'email', oldValue: 'a', newValue: 'b' }, { field: 'status', oldValue: null, newValue: null }]);
    expect(sanitizeAuditReason()).toBeNull();
    expect(sanitizeAuditReason(' ')).toBeNull();
    expect(sanitizeAuditReason('LOGIN_SUCCESS')).toBe('LOGIN_SUCCESS');
    expect(sanitizeAuditReason('contains password')).toBeNull();
    expect(sanitizeAuditReason(' human readable reason ')).toBe('human readable reason');
    expect(sanitizeAuditUserAgent()).toBeNull();
    expect(sanitizeAuditUserAgent('abcdef', 3)).toBe('abc');
    expect(sanitizeAuditRequestId()).toBeNull();
    expect(sanitizeAuditRequestId('bad id')).toBeNull();
    expect(sanitizeAuditRequestId('request-1_2')).toBe('request-1_2');
  });
});

describe('roadmap coverage: CRM policies', () => {
  it('covers closure, qualification and lead lifecycle decision rules', () => {
    const closure = new ClosurePolicy();
    expect(closure.decide('  sold  ', 'WON')).toEqual({ reason: 'sold', outcome: 'WON' });
    expect(() => closure.decide(' ', 'LOST')).toThrow('Closure reason is required');
    const qualification = new QualificationPolicy();
    expect(qualification.evaluate(10, '  score  ')).toEqual({ qualified: true, score: 10, reason: 'score' });
    expect(qualification.evaluate(0, 'none').qualified).toBe(false);
    expect(() => qualification.evaluate(1, ' ')).toThrow('Qualification reason is required');
    const lifecycle = new LeadLifecyclePolicy();
    expect(() => lifecycle.assertCan('QUALIFY', 'NEW')).not.toThrow();
    expect(() => lifecycle.assertCan('QUALIFY', 'CLOSED_WON')).toThrow();
    expect(() => lifecycle.assertCan('NURTURE', 'CLOSED_LOST')).toThrow();
    expect(() => lifecycle.assertCan('REACTIVATE', 'NEW')).toThrow();
    expect(() => lifecycle.assertCan('REACTIVATE', 'ARCHIVED')).not.toThrow();
    expect(() => lifecycle.assertCan('CLOSE', 'CLOSED_WON')).toThrow();
    expect(() => lifecycle.assertCan('CLOSE', 'CONTACTED')).not.toThrow();
    expect(() => lifecycle.assertCan('CLOSE', '')).toThrow('Lead status is required');
    expect(canTransition('NEW', 'CONTACTED')).toBe(true);
    expect(canTransition('NEW', 'CLOSED_WON')).toBe(false);
    expect(allowedTransitions('NURTURING')).toContain('QUALIFIED');
  });

  it('covers duplicate detector confidence branches and merge policy', () => {
    const detector = new DuplicateDetector();
    const matches = detector.detect(
      { leadUuid: 'a', email: 'A@Example.COM', phone: '+62 (812) 123', displayName: 'Alice' },
      [
        { leadUuid: 'a', email: 'A@Example.COM', phone: '+62 (812) 123', displayName: 'Alice' },
        { leadUuid: 'b', email: 'a@example.com', phone: '+62 812123', displayName: 'Alice' },
        { leadUuid: 'c', email: 'x@example.com', phone: '+62 812123', displayName: 'Bob' },
        { leadUuid: 'd', email: 'x@example.com', phone: 'x', displayName: 'Bob' },
      ],
    );
    expect(matches[0]).toMatchObject({ candidateLeadUuid: 'b', confidence: 110 });
    expect(matches[1]).toMatchObject({ candidateLeadUuid: 'c', confidence: 30 });
    expect(matches).toHaveLength(1);
    const merge = new LeadMergePolicy();
    expect(() => merge.assertAllowed('a', 'b', false)).toThrow('Lead merge permission is required');
    expect(() => merge.assertAllowed('a', 'a', true)).toThrow('Cannot merge a lead into itself');
    expect(() => merge.assertAllowed('a', 'b', true)).not.toThrow();
    expect(merge.merge({ uuid: 'a', name: 'source', phone: '123', email: '' }, { uuid: 'b', name: '', phone: null, email: 'existing' })).toEqual({ uuid: 'b', name: 'source', phone: '123', email: 'existing' });
  });
});

describe('roadmap coverage: auth and analytics primitives', () => {
  it('covers refresh token, family, two-factor entity and analytics errors', () => {
    const base = {
      id: '1', familyId: uuid, userUuid: uuid, sessionId: '42', tokenHash: 'a'.repeat(64),
      issuedAt: now, expiresAt: new Date('2026-01-02T00:00:00.000Z'), consumedAt: null, revokedAt: null, revokeReason: null,
    } as const;
    const token = RefreshTokenEntity.create(base);
    expect(token.state(now)).toBe('ACTIVE');
    expect(() => token.assertRefreshable(now)).not.toThrow();
    expect(RefreshTokenEntity.create({ ...base, consumedAt: now }).state(now)).toBe('CONSUMED');
    expect(RefreshTokenEntity.create({ ...base, revokedAt: now, revokeReason: 'LOGOUT' }).state(now)).toBe('REVOKED');
    const expired = RefreshTokenEntity.create({ ...base, expiresAt: new Date('2025-12-31T23:59:00.000Z') });
    expect(expired.state(now)).toBe('EXPIRED');
    expect(() => expired.assertRefreshable(now)).toThrow('expired');
    expect(() => RefreshTokenEntity.create({ ...base, tokenHash: 'x' })).toThrow('Invalid refresh token digest');
    const family = RefreshTokenFamilyEntity.create({ id: uuid, userUuid: uuid, sessionId: '42', revokedAt: null, revokeReason: null, createdAt: now, updatedAt: now });
    expect(family.status()).toBe('active');
    expect(family.isActive()).toBe(true);
    const revokedFamily = RefreshTokenFamilyEntity.create({ ...familySnapshot(family), revokedAt: now, revokeReason: 'LOGOUT' });
    expect(revokedFamily.status()).toBe('revoked');
    expect(() => RefreshTokenFamilyEntity.create({ id: 'bad', userUuid: uuid, sessionId: '42', revokedAt: null, revokeReason: null, createdAt: now, updatedAt: now })).toThrow();
    const tf = TwoFactorEntity.create({ id: 1n, userUuid: uuid, method: 'totp', secretEncrypted: 'secret', enabledAt: null, lastUsedAt: null, lastUsedTimeStep: null, enrollmentStartedAt: now, failedVerificationAttempts: 1, lockedUntil: new Date('2026-01-01T00:05:00Z'), createdAt: now, updatedAt: now });
    expect(tf.status).toBe('PENDING');
    expect(tf.isPending()).toBe(true);
    expect(tf.isLocked(now)).toBe(true);
    const enabled = TwoFactorEntity.create({ ...tf.toPersistence(), enabledAt: now, lastUsedTimeStep: 3n, lockedUntil: new Date('2025-12-31T00:00:00Z') });
    expect(enabled.status).toBe('ENABLED');
    expect(enabled.lastUsedTimeStep()).toBe(3n);
    const errors = [new AnalyticsInvalidQueryException(), new AnalyticsInvalidQueryException('bad'), new AnalyticsScopeException(), new AnalyticsScopeException('forbidden'), new AnalyticsQueryTimeoutException(), new AnalyticsUnavailableException()];
    expect(errors.map((error) => error.getStatus())).toEqual([400, 400, 403, 403, 504, 503]);
    const rp = RolePermissionEntity.create({ roleUuid: uuid, permissionUuid: uuid, createdAt: now, updatedAt: now });
    expect(rp.toSnapshot().roleUuid).toBe(uuid);
  });
});

function familySnapshot(entity: RefreshTokenFamilyEntity) {
  return {
    id: entity.id,
    userUuid: entity.userUuid,
    sessionId: entity.sessionId,
    revokedAt: entity.revokedAt,
    revokeReason: entity.revokeReason,
    createdAt: now,
    updatedAt: now,
  };
}

void ({} satisfies { guard: CanActivate | null });
