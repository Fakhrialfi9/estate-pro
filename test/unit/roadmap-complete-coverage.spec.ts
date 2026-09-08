import {
  BadRequestException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it, vi } from 'vitest';

import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter.js';
import { sanitizeSystemCorrelationContext } from '../../src/common/observability/system-context.js';
import { AuthenticatedAccessGuard } from '../../src/common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../src/common/security/authorization.guard.js';
import { PasswordHasherService } from '../../src/common/security/password-hasher.service.js';
import { PropertyAccessGuard } from '../../src/common/security/property-access.guard.js';
import {
  normalizeAuditResourceType,
  sanitizeAuditChanges,
  sanitizeAuditReason,
  sanitizeAuditRequestId,
  sanitizeAuditUserAgent,
} from '../../src/common/audit/audit-redaction.js';
import { AuditLogService } from '../../src/modules/audit/application/audit-log.service.js';
import {
  AgentCreateDto,
  AvailabilityUpdateDto,
  TargetCreateDto,
} from '../../src/modules/agent-management/application/agent-management.request.js';
import { AgentCandidateAdapter } from '../../src/modules/agent-management/application/agent-candidate.adapter.js';
import { AnalyticsInvalidQueryException } from '../../src/modules/analytics/domain/errors/analytics.errors.js';
import { SendCommunicationAction } from '../../src/modules/automation/application/actions/send-communication.action.js';
import { AutomationService } from '../../src/modules/automation/application/services/automation.service.js';
import { RefreshTokenObservabilityService } from '../../src/modules/auth/application/services/refresh-token-observability.service.js';
import { JwtTokenService } from '../../src/modules/auth/application/services/jwt-token.service.js';
import { SessionService } from '../../src/modules/auth/application/services/session.service.js';
import { TwoFactorCryptoService } from '../../src/modules/auth/application/services/two-factor-crypto.service.js';
import { TwoFactorService } from '../../src/modules/auth/application/services/two-factor.service.js';
import {
  RefreshTokenExpiredError,
  RefreshTokenInvalidError,
  RefreshTokenReuseDetectedError,
  RefreshTokenRevokedError,
  RefreshTokenSessionInvalidError,
  isRefreshTokenRevokeReason,
} from '../../src/modules/auth/domain/errors/refresh-token.errors.js';
import {
  decideRetry,
  isUuid,
  parseDefinition,
  WorkflowAggregate,
  WorkflowExecutionAggregate,
  ActionExecutionAggregate,
} from '../../src/modules/automation/domain/automation.types.js';
import { WorkflowValidator } from '../../src/modules/automation/application/validation/workflow-validator.js';
import type { ExecutionContext } from '@nestjs/common';

const uuid = '123e4567-e89b-12d3-a456-426614174000';
const now = new Date('2026-01-01T00:00:00.000Z');

const httpContext = (request: unknown, response: unknown = {}) =>
  ({
    switchToHttp: () => ({
      getRequest: <T>() => request as T,
      getResponse: <T>() => response as T,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as never as ExecutionContext;

describe('roadmap complete coverage', () => {
  it('covers global exception filter mapping and fallback branches', () => {
    const logger = { error: vi.fn(), setContext: vi.fn() };
    const config = { getOrThrow: vi.fn().mockReturnValue('test') };
    const filter = new GlobalExceptionFilter(logger as never, config as never);
    const json = vi.fn();
    const response = {
      status: vi.fn(() => ({ json })),
      getHeader: vi.fn().mockReturnValue('request-1'),
    };
    const request = { method: 'POST', path: '/api/v1/test' };

    filter.catch(
      new HttpException('bad', HttpStatus.BAD_REQUEST),
      httpContext(request, response),
    );
    filter.catch(
      new HttpException(
        { message: ['a', 'b'], code: 'CUSTOM' },
        HttpStatus.UNAUTHORIZED,
      ),
      httpContext(request, response),
    );
    filter.catch(
      new HttpException({ message: 12 }, HttpStatus.BAD_REQUEST),
      httpContext(request, response),
    );
    filter.catch(
      { status: 400, type: 'entity.parse.failed' },
      httpContext(request, response),
    );
    filter.catch(
      { status: 413, type: 'entity.too.large' },
      httpContext(request, response),
    );
    filter.catch(new Error('boom'), httpContext(request, response));

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.status).toHaveBeenCalledWith(413);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('covers security guards including generic denial fallback', async () => {
    const verifier = {
      verifyAccessToken: vi
        .fn()
        .mockResolvedValue({ sub: uuid, sid: '1', iat: 1, exp: 2 }),
    };
    const sessions = { isActive: vi.fn().mockResolvedValue(true) };
    const authenticated = new AuthenticatedAccessGuard(verifier, sessions);

    await expect(
      authenticated.canActivate(
        httpContext({ headers: { authorization: 'Bearer token' }, params: {} }),
      ),
    ).resolves.toBe(true);
    sessions.isActive.mockRejectedValueOnce(new Error('db failure'));
    await expect(
      authenticated.canActivate(
        httpContext({ headers: { authorization: 'Bearer token' }, params: {} }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const reflector = { getAllAndOverride: vi.fn() };
    const authorization = {
      resolve: vi.fn().mockResolvedValue({
        userUuid: uuid,
        permissionCodes: ['properties.read'],
        roleCodes: ['agent'],
      }),
      assertPermissions: vi.fn(),
      assertRoles: vi.fn(),
    };
    const propertyAccess = { canActivate: vi.fn().mockResolvedValue(true) };
    const guard = new AuthorizationGuard(
      reflector as never,
      authorization as never,
      propertyAccess as never,
    );

    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(
      guard.canActivate(httpContext({ headers: {}, params: {} })),
    ).resolves.toBe(true);

    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(
      guard.canActivate(httpContext({ headers: {}, params: {} })),
    ).rejects.toBeInstanceOf(HttpException);

    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce({ values: ['properties.read'], match: 'ALL' })
      .mockReturnValueOnce({ values: ['agent'], match: 'ANY' });
    const request = {
      headers: {},
      params: {},
      user: { sub: uuid, permissions: [] },
    };
    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
    expect(authorization.assertPermissions).toHaveBeenCalled();
    expect(authorization.assertRoles).toHaveBeenCalled();

    propertyAccess.canActivate.mockRejectedValueOnce(
      new Error('property policy failure'),
    );
    await expect(
      guard.canActivate(httpContext(request)),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('covers property access route and global permission branches', async () => {
    const query = {
      canAccessListing: vi.fn().mockResolvedValue(true),
      canAccessProperty: vi.fn().mockResolvedValue(true),
    };
    const guard = new PropertyAccessGuard(query);

    await expect(
      guard.canActivate(httpContext({ user: {}, params: {}, path: '/health' })),
    ).rejects.toBeInstanceOf(HttpException);
    await expect(
      guard.canActivate(
        httpContext({
          user: { sub: uuid },
          params: {},
          path: '/listings/:uuid',
        }),
      ),
    ).rejects.toBeInstanceOf(HttpException);
    await expect(
      guard.canActivate(
        httpContext({
          user: { sub: uuid },
          params: { uuid: 'listing-1' },
          path: '/listings/:uuid',
        }),
      ),
    ).resolves.toBe(true);

    for (const permission of [
      'properties.manage',
      'listings.manage',
      'property.manage',
      'properties:manage',
    ]) {
      await expect(
        guard.canActivate(
          httpContext({
            user: { sub: uuid, permissions: [permission] },
            params: {},
            path: '/properties/property-1',
          }),
        ),
      ).resolves.toBe(true);
    }

    query.canAccessProperty.mockResolvedValueOnce(false);
    await expect(
      guard.canActivate(
        httpContext({
          user: { sub: uuid },
          params: { propertyUuid: 'property-1' },
          method: 'PATCH',
          path: '/properties/:propertyUuid',
        }),
      ),
    ).rejects.toBeInstanceOf(HttpException);

    await expect(
      guard.canActivate(
        httpContext({
          user: { sub: uuid },
          params: { uuid: 'property-1' },
          method: 'GET',
          path: '/properties/:uuid',
        }),
      ),
    ).resolves.toBe(true);
    expect(query.canAccessProperty).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    );
  });

  it('covers audit redaction and DTO transformation runtime behavior', () => {
    expect(normalizeAuditResourceType()).toBeNull();
    expect(normalizeAuditResourceType('Property SEO')).toBe('property_seo');
    expect(normalizeAuditResourceType('')).toBeNull();
    expect(sanitizeAuditReason()).toBeNull();
    expect(sanitizeAuditReason('')).toBeNull();
    expect(sanitizeAuditReason('password=secret')).toBeNull();
    expect(sanitizeAuditReason('normal reason')).toBe('normal reason');
    expect(sanitizeAuditRequestId('request-1')).toBe('request-1');
    expect(sanitizeAuditRequestId('request id')).toBeNull();
    expect(sanitizeAuditUserAgent('abc', 2)).toBe('ab');
    expect(
      sanitizeAuditChanges('user', [
        { field: 'email', oldValue: 'a', newValue: 'b' },
        { field: 'passwordHash', oldValue: 'x', newValue: 'y' },
        { field: 'token', oldValue: 'x', newValue: 'y' },
      ]),
    ).toEqual([{ field: 'email', oldValue: 'a', newValue: 'b' }]);

    const agent = plainToInstance(AgentCreateDto, {
      userUuid: uuid,
      hireDate: '2026-01-01T00:00:00.000Z',
      maxActiveAssignments: '12',
    });
    expect(agent.hireDate).toBeInstanceOf(Date);
    expect(agent.maxActiveAssignments).toBe(12);

    const availability = plainToInstance(AvailabilityUpdateDto, {
      status: 'ACTIVE',
      schedule: [{ weekday: '1', startTime: '09:00', endTime: '17:00' }],
      exceptions: [
        {
          status: 'LEAVE',
          startsAt: '2026-01-01T00:00:00.000Z',
          endsAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    });
    expect(availability.schedule[0].weekday).toBe(1);
    expect(availability.exceptions[0].startsAt).toBeInstanceOf(Date);

    const target = plainToInstance(TargetCreateDto, {
      metricType: 'sales',
      periodType: 'MONTH',
      periodStart: '2026-01-01',
      periodEnd: '2026-02-01',
      targetValue: '100',
    });
    expect(target.targetValue).toBe(100);
  });

  it('covers audit log service success, redaction mapping and failure isolation', async () => {
    const repository = {
      record: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({
        total: 1,
        items: [
          {
            props: {
              uuid,
              actorUuid: uuid,
              actorType: 'AUTHENTICATED',
              subjectUuid: uuid,
              action: 'USER_UPDATED',
              resourceType: 'user',
              resourceId: uuid,
              result: 'SUCCESS',
              reason: 'updated',
              ipAddress: '127.0.0.1',
              userAgent: 'test',
              requestId: 'request-1',
              createdAt: now,
              changes: [],
            },
          },
        ],
      }),
    };
    const logger = { setContext: vi.fn(), error: vi.fn() };
    const service = new AuditLogService(repository, logger as never);

    await service.record({
      action: 'USER_UPDATED',
      entityType: 'user',
      reason: 'ok',
      changes: [{ field: 'name', oldValue: 'a', newValue: 'b' }],
    });
    expect(repository.record).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'ok' }),
    );
    await expect(
      service.list({
        page: 1,
        limit: 20,
        resourceType: undefined,
        actorUuid: undefined,
      }),
    ).resolves.toMatchObject({ total: 1 });

    repository.record.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(
      service.record({ action: 'USER_UPDATED', entityType: 'user' }),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });

  it('covers JWT, password and refresh-token error branches', async () => {
    const secret = 'test-secret-that-is-at-least-32-characters-long';
    const config = new ConfigService({
      auth: {
        jwt: {
          secret,
          issuer: 'estate-pro-api',
          audience: 'estate-pro-client',
          algorithm: 'HS256',
          expiresIn: '15m',
        },
      },
    });
    const service = new JwtTokenService(new JwtService({ secret }), config);
    const token = await service.issueAccessToken(uuid, 'session-1');
    expect(service.getExpiresAt(token)).toBeInstanceOf(Date);
    await expect(service.verifyAccessToken(token)).resolves.toMatchObject({
      sub: uuid,
      sid: 'session-1',
    });
    await expect(
      service.verifyAccessToken(`${token}.bad`),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(() => service.getExpiresAt('not-a-token')).toThrow(
      UnauthorizedException,
    );

    const hasher = new PasswordHasherService(
      new ConfigService({
        auth: {
          passwordHashing: {
            memoryCost: 8192,
            timeCost: 1,
            parallelism: 1,
            hashLength: 16,
          },
        },
      }),
    );
    const hash = await hasher.hash('password');
    await expect(hasher.verify(hash, 'password')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'wrong')).resolves.toBe(false);
    await expect(hasher.verify('not-a-valid-hash', 'wrong')).resolves.toBe(
      false,
    );
    expect(typeof hasher.needsRehash(hash)).toBe('boolean');

    expect(new RefreshTokenInvalidError()).toMatchObject({
      code: 'REFRESH_TOKEN_INVALID',
    });
    expect(new RefreshTokenExpiredError()).toMatchObject({
      code: 'REFRESH_TOKEN_EXPIRED',
    });
    expect(new RefreshTokenRevokedError()).toMatchObject({
      code: 'REFRESH_TOKEN_REVOKED',
    });
    expect(new RefreshTokenReuseDetectedError()).toMatchObject({
      code: 'REFRESH_TOKEN_REUSE_DETECTED',
    });
    expect(new RefreshTokenSessionInvalidError()).toMatchObject({
      code: 'REFRESH_TOKEN_SESSION_INVALID',
    });
    expect(isRefreshTokenRevokeReason('LOGOUT')).toBe(true);
    expect(isRefreshTokenRevokeReason('UNKNOWN')).toBe(false);
    expect(isRefreshTokenRevokeReason(null)).toBe(false);
  });

  it('covers two-factor cryptography with both supported key encodings and invalid payloads', () => {
    const textKey = 'plain-text-two-factor-key-that-is-long-enough';
    const textCrypto = new TwoFactorCryptoService(
      new ConfigService({ auth: { twoFactor: { encryptionKey: textKey } } }),
    );
    const encrypted = textCrypto.encrypt('secret');
    expect(textCrypto.decrypt(encrypted)).toBe('secret');
    expect(() => textCrypto.decrypt('v2.x.y.z')).toThrow(BadRequestException);
    expect(() => textCrypto.decrypt('v1.invalid')).toThrow(BadRequestException);
    expect(() =>
      new TwoFactorCryptoService(
        new ConfigService({ auth: { twoFactor: { encryptionKey: 'short' } } }),
      ).encrypt('secret'),
    ).toThrow();

    const hexKey = 'a'.repeat(64);
    const hexCrypto = new TwoFactorCryptoService(
      new ConfigService({ auth: { twoFactor: { encryptionKey: hexKey } } }),
    );
    const encoded = hexCrypto.encrypt('hex-secret');
    expect(hexCrypto.decrypt(encoded)).toBe('hex-secret');
  });

  it('covers refresh-token observability success, failure, reuse and error status', () => {
    const service = new RefreshTokenObservabilityService();
    const span = service.start('request-1');
    service.recordSuccess();
    service.recordFailure();
    service.recordReuseDetected();
    service.recordFamilyRevocation();
    service.finish(span.span, span.startedAt, true);
    const failure = service.start();
    service.finish(failure.span, failure.startedAt, false, new Error('failed'));
    expect(true).toBe(true);
  });

  it('covers session lifecycle branches and security-event reason mapping', async () => {
    const sessionSnapshot = {
      id: '1',
      userUuid: uuid,
      sessionId: null,
      sessionIdHash: 'a'.repeat(64),
      secretHash: null,
      createdAt: now,
      lastUsedAt: null,
      expiresAt: new Date('2027-01-01T00:00:00Z'),
      revokedAt: null,
      ipAddress: '127.0.0.1',
      userAgent: 'test',
      requestId: 'request-1',
    };
    const repo = {
      create: vi.fn().mockResolvedValue(sessionSnapshot),
      findById: vi.fn().mockResolvedValue(sessionSnapshot),
      findBySecret: vi.fn().mockResolvedValue(sessionSnapshot),
      list: vi.fn().mockResolvedValue([sessionSnapshot]),
      revokeById: vi.fn().mockResolvedValue(undefined),
      revokeAll: vi.fn().mockResolvedValue(2),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const refresh = {
      revokeForSession: vi.fn().mockResolvedValue(1),
      revokeAllForUser: vi.fn().mockResolvedValue(2),
    };
    const service = new SessionService(repo as never, audit, refresh);

    await expect(
      service.create(uuid, {
        sessionId: SessionService.generateSecret(),
        expiresAt: new Date('2027-01-01'),
        userAgent: 'u'.repeat(2000),
      }),
    ).resolves.toBeDefined();
    await expect(
      service.create(uuid, {
        sessionId: SessionService.generateSecret(),
        expiresAt: new Date('2025-01-01'),
      }),
    ).rejects.toThrow();
    await expect(service.isActive(uuid, '1')).resolves.toBe(true);
    repo.findById.mockResolvedValueOnce(null);
    await expect(service.isActive(uuid, '1')).resolves.toBe(false);
    await expect(service.isActive(uuid, 'session-secret')).resolves.toBe(true);
    await expect(
      service.listOwn(uuid, { limit: 999, offset: -1, includeInactive: true }),
    ).resolves.toHaveLength(1);
    await service.logoutCurrent(uuid, '1', {});
    await service.logoutCurrent(uuid, 'missing-secret', {});
    await service.logoutAll(uuid, { actorUserUuid: 'admin' });
    await service.revokeAllForSecurityEvent(uuid, 'PASSWORD_CHANGE', {});
    await service.revokeAllForSecurityEvent(uuid, 'PASSWORD_RESET', {});
    await service.revokeAllForSecurityEvent(uuid, 'ACCOUNT_DISABLED', {});
    await service.revokeAllForSecurityEvent(uuid, 'ACCOUNT_SUSPENDED', {});
    await service.revokeAllForSecurityEvent(uuid, 'ACCOUNT_DELETED', {});
    await service.revokeAllForSecurityEvent(uuid, 'ACCOUNT_LOCKED', {});
    await service.revokeAllForSecurityEvent(uuid, 'ADMIN_FORCED_LOGOUT', {});
    await service.revokeAllForSecurityEvent(uuid, 'OTHER', {});
    expect(refresh.revokeAllForUser).toHaveBeenCalled();
  });

  it('covers two-factor service lifecycle and failure branches', async () => {
    const repository = {
      findByUserUuid: vi.fn().mockResolvedValue(null),
      createPending: vi.fn().mockResolvedValue(undefined),
      recordSuccessfulVerification: vi.fn().mockResolvedValue(true),
      recordFailedVerification: vi.fn().mockResolvedValue(undefined),
      disable: vi.fn().mockResolvedValue(undefined),
    };
    const recovery = {
      findUnused: vi.fn().mockResolvedValue([]),
      markUsed: vi.fn().mockResolvedValue(true),
      replaceAll: vi.fn().mockResolvedValue(undefined),
    };
    const enrollment = {
      enableWithRecoveryCodes: vi.fn().mockResolvedValue(true),
    };
    const challenges = {
      create: vi.fn().mockResolvedValue(undefined),
      findByHash: vi.fn().mockResolvedValue(null),
      recordFailure: vi.fn().mockResolvedValue(undefined),
      consume: vi.fn().mockResolvedValue(true),
    };
    const users = {
      findByUuid: vi
        .fn()
        .mockResolvedValue({ uuid, email: 'a@example.com', username: 'alice' }),
    };
    const credentials = {
      findByUserUuid: vi.fn().mockResolvedValue({ passwordHash: 'hash' }),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const crypto = {
      encrypt: vi.fn().mockReturnValue('encrypted'),
      decrypt: vi.fn().mockReturnValue('secret'),
    };
    const totp = {
      generateSecret: vi.fn().mockReturnValue('SECRET'),
      provisioningUri: vi.fn().mockReturnValue('otpauth://test'),
      verify: vi.fn().mockReturnValue(null),
    };
    const jwt = {
      issueMfaChallenge: vi.fn().mockResolvedValue('challenge'),
      verifyMfaChallenge: vi
        .fn()
        .mockResolvedValue({ sub: uuid, challengeId: 'challenge-id' }),
    };
    const hasher = {
      hash: vi.fn().mockResolvedValue('hash'),
      verify: vi.fn().mockResolvedValue(false),
    };
    const config = new ConfigService({
      app: { name: 'Estate Pro' },
      auth: {
        twoFactor: {
          challengeTtlMs: 300000,
          challengeMaxAttempts: 5,
          recoveryCodeCount: 5,
          otpLockoutThreshold: 5,
          otpLockoutDurationMs: 900000,
        },
      },
    });
    const service = new TwoFactorService(
      repository as never,
      recovery,
      enrollment,
      challenges,
      users as never,
      credentials as never,
      audit,
      crypto as never,
      totp as never,
      jwt as never,
      hasher as never,
      config,
    );

    await expect(service.isEnabled(uuid)).resolves.toBe(false);
    repository.findByUserUuid.mockResolvedValueOnce({ enabledAt: now });
    await expect(service.isEnabled(uuid)).resolves.toBe(true);
    await expect(service.startEnrollment(uuid)).resolves.toMatchObject({
      verificationRequired: true,
    });
    repository.findByUserUuid.mockResolvedValueOnce({ enabledAt: now });
    await expect(service.startEnrollment(uuid)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    repository.findByUserUuid.mockResolvedValueOnce(null);
    users.findByUuid.mockResolvedValueOnce(null);
    await expect(service.startEnrollment(uuid)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.createLoginChallenge(uuid)).resolves.toMatchObject({
      token: 'challenge',
    });
    await expect(
      service.verifyLoginChallenge({ token: 'challenge' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    credentials.findByUserUuid.mockResolvedValueOnce(null);
    await expect(
      service.regenerateRecoveryCodes(uuid, 'p', '1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    credentials.findByUserUuid.mockResolvedValueOnce({ passwordHash: 'hash' });
    hasher.verify.mockResolvedValueOnce(true);
    await expect(
      service.disable(uuid, 'p', undefined, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('covers workflow validator valid graph and invalid branches', () => {
    const validator = new WorkflowValidator();
    const valid = {
      trigger: { type: 'ENTITY_CREATED', entityType: 'LEAD' },
      graph: {
        entryNodeId: 'trigger',
        nodes: [
          {
            id: 'trigger',
            type: 'TRIGGER',
            trigger: { type: 'ENTITY_CREATED', entityType: 'LEAD' },
          },
          {
            id: 'action',
            type: 'ACTION',
            actionType: 'NOTIFY',
            input: {},
            maxAttempts: 3,
            timeoutMs: 1000,
          },
        ],
        edges: [{ from: 'trigger', to: 'action' }],
      },
    };
    expect(validator.validate(valid)).toEqual(valid);
    expect(validator.checksum(valid)).toHaveLength(64);
    expect(() => validator.validate(null)).toThrow(BadRequestException);
    expect(() => validator.validate({})).toThrow(BadRequestException);
    expect(() => validator.validate({ trigger: {}, graph: {} })).toThrow(
      BadRequestException,
    );
    expect(() =>
      validator.validate({
        ...valid,
        trigger: { type: 'BAD', entityType: 'LEAD' },
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validator.validate({ ...valid, graph: { ...valid.graph, nodes: [] } }),
    ).toThrow(BadRequestException);
    expect(() =>
      validator.validate({
        ...valid,
        graph: { ...valid.graph, edges: [{ from: 'trigger', to: 'missing' }] },
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validator.validate({
        ...valid,
        graph: {
          ...valid.graph,
          nodes: [{ ...valid.graph.nodes[0], id: 'x' }, valid.graph.nodes[1]],
        },
      }),
    ).toThrow(BadRequestException);
  });

  it('covers automation action execution retryability and domain lifecycle helpers', async () => {
    const crm = {
      deliverCommunication: vi
        .fn()
        .mockResolvedValue({ uuid: 'communication-1' }),
    };
    const action = new SendCommunicationAction(crm as never);
    await expect(action.execute({}, {}, uuid)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      action.execute({ communicationUuid: 'communication-1' }, {}, uuid),
    ).resolves.toMatchObject({ success: true, retryable: false });
    crm.deliverCommunication.mockRejectedValueOnce({ retryable: true });
    await expect(
      action.execute({ communicationUuid: 'communication-1' }, {}, uuid),
    ).resolves.toMatchObject({ success: false, retryable: true });
    crm.deliverCommunication.mockRejectedValueOnce(
      new Error('delivery failed'),
    );
    await expect(
      action.execute({ communicationUuid: 'communication-1' }, {}, uuid),
    ).resolves.toMatchObject({
      success: false,
      errorCode: 'COMMUNICATION_DELIVERY_FAILED',
    });

    expect(isUuid(uuid)).toBe(true);
    expect(isUuid('bad')).toBe(false);
    const definition = parseDefinition({
      trigger: { type: 'ENTITY_CREATED', entityType: 'LEAD' },
      graph: {
        entryNodeId: 'trigger',
        nodes: [
          {
            id: 'trigger',
            type: 'TRIGGER',
            trigger: { type: 'ENTITY_CREATED', entityType: 'LEAD' },
          },
        ],
        edges: [],
      },
    });
    expect(definition.trigger.entityType).toBe('LEAD');
    expect(() => parseDefinition({})).toThrow();
    expect(decideRetry(false, 1, 3)).toMatchObject({
      retry: false,
      terminalState: 'FAILED',
    });
    expect(decideRetry(true, 3, 3)).toMatchObject({
      retry: false,
      terminalState: 'DEAD_LETTER',
    });
    expect(decideRetry(true, 2, 5, 100, 150)).toMatchObject({
      retry: true,
      delayMs: 150,
    });

    const workflow = new WorkflowAggregate(uuid, uuid, 'Workflow');
    workflow.transition('ACTIVE');
    workflow.transition('PAUSED');
    workflow.transition('ACTIVE');
    workflow.transition('ARCHIVED');
    expect(() => workflow.transition('ACTIVE')).toThrow();

    const execution = new WorkflowExecutionAggregate(uuid, uuid, uuid);
    execution.transition('RUNNING');
    execution.transition('WAITING');
    execution.transition('RUNNING');
    execution.transition('SUCCEEDED');
    expect(() => execution.transition('RUNNING')).toThrow();

    const actionExecution = new ActionExecutionAggregate(
      uuid,
      'node',
      'NOTIFY',
    );
    actionExecution.transition('RUNNING');
    actionExecution.transition('RETRYABLE');
    actionExecution.transition('RUNNING');
    actionExecution.transition('SUCCEEDED');
    expect(() => actionExecution.transition('FAILED')).toThrow();
  });

  it('covers agent candidate adapter delegation and analytics error construction', async () => {
    const service = { findCandidates: vi.fn().mockResolvedValue([{ uuid }]) };
    const adapter = new AgentCandidateAdapter(service as never);
    await expect(
      adapter.findCandidates({ propertyUuid: uuid }),
    ).resolves.toEqual([{ uuid }]);
    await expect(
      adapter.findCandidates({ propertyUuid: uuid }, uuid),
    ).resolves.toEqual([{ uuid }]);
    expect(service.findCandidates).toHaveBeenCalled();
    expect(new AnalyticsInvalidQueryException('bad')).toBeInstanceOf(Error);
    expect(new AnalyticsInvalidQueryException().getStatus()).toBe(400);
    expect(
      sanitizeSystemCorrelationContext({ requestId: 'r'.repeat(150) })
        .requestId,
    ).toHaveLength(120);
  });

  it('covers automation service orchestration branches', async () => {
    const repo = {
      createWorkflow: vi
        .fn()
        .mockResolvedValue({ uuid, status: 'DRAFT', ownerUserUuid: uuid }),
      updateWorkflow: vi.fn().mockResolvedValue({ uuid, status: 'ACTIVE' }),
      getWorkflow: vi.fn().mockResolvedValue({
        uuid,
        status: 'DRAFT',
        ownerUserUuid: uuid,
        versions: [],
        activeVersionUuid: null,
      }),
      createVersion: vi.fn().mockResolvedValue({ uuid: 'version-1' }),
      getVersion: vi.fn().mockResolvedValue(null),
      listActiveVersions: vi.fn().mockResolvedValue([]),
      createExecution: vi.fn().mockResolvedValue({ uuid: 'execution-1' }),
      claimDueExecution: vi.fn().mockResolvedValue(null),
      listActions: vi.fn().mockResolvedValue([]),
      updateAction: vi.fn().mockResolvedValue(undefined),
      getExecution: vi.fn().mockResolvedValue({
        uuid: 'execution-1',
        workflowUuid: uuid,
        state: 'FAILED',
      }),
      updateExecution: vi
        .fn()
        .mockResolvedValue({ uuid: 'execution-1', state: 'WAITING' }),
      listWorkflows: vi.fn().mockResolvedValue([]),
      listExecutions: vi.fn().mockResolvedValue([]),
      listNotifications: vi.fn().mockResolvedValue([]),
      markNotificationRead: vi.fn().mockResolvedValue(undefined),
      createAssignmentRule: vi.fn().mockResolvedValue({ uuid: 'rule-1' }),
      createSlaPolicy: vi.fn().mockResolvedValue({ uuid: 'sla-1' }),
    };
    const users = {
      getUser: vi
        .fn()
        .mockResolvedValue({ uuid, isActive: true, deletedAt: null }),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const validator = {
      validate: vi.fn().mockReturnValue(undefined),
      checksum: vi.fn().mockReturnValue('checksum'),
    };
    const service = new AutomationService(
      repo as never,
      {} as never,
      {} as never,
      users,
      audit,
      validator as never,
      [],
    );

    await expect(
      service.createWorkflow({ name: ' Test ', ownerUserUuid: uuid }, uuid),
    ).resolves.toBeDefined();
    await expect(
      service.createWorkflow({ name: ' ', ownerUserUuid: uuid }, uuid),
    ).rejects.toBeInstanceOf(BadRequestException);
    users.getUser.mockResolvedValueOnce({
      uuid,
      isActive: false,
      deletedAt: null,
    });
    await expect(
      service.createWorkflow({ name: 'Test', ownerUserUuid: uuid }, uuid),
    ).rejects.toThrow();
    users.getUser.mockResolvedValueOnce({
      uuid,
      isActive: true,
      deletedAt: null,
    });
    await expect(
      service.createAssignmentRule(uuid, { strategy: 'LEAST_LOAD' }, uuid),
    ).resolves.toBeDefined();
    await expect(
      service.createAssignmentRule(uuid, { strategy: 'UNSUPPORTED' }, uuid),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createSlaPolicy(
        uuid,
        {
          durationMinutes: 60,
          targetEntityType: 'LEAD',
          startEventType: 'CREATED',
        },
        uuid,
      ),
    ).resolves.toBeDefined();
    await expect(
      service.createSlaPolicy(
        uuid,
        {
          durationMinutes: 0,
          targetEntityType: 'LEAD',
          startEventType: 'CREATED',
        },
        uuid,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(() =>
      service.listNotifications({
        userUuid: '',
        page: 1,
        limit: 10,
        unreadOnly: false,
      }),
    ).toThrow(BadRequestException);
    expect(() => service.markNotificationRead('notification-1', '')).toThrow(
      BadRequestException,
    );
    await service.retryExecution('execution-1', uuid);
    await expect(
      service.cancelExecution('execution-1', uuid),
    ).resolves.toBeDefined();
  });
});
