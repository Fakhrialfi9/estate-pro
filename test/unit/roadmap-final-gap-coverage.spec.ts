import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';

import type { AccessTokenClaims } from '../../src/common/security/access-token-verifier.port.js';
import { AuthenticatedAccessGuard } from '../../src/common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../src/common/security/authorization.guard.js';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter.js';
import { PropertyAccessGuard } from '../../src/common/security/property-access.guard.js';
import { AgentCandidateAdapter } from '../../src/modules/agent-management/application/agent-candidate.adapter.js';
import { ClosurePolicy } from '../../src/modules/crm/domain/closure.policy.js';
import { LeadLifecyclePolicy } from '../../src/modules/crm/domain/lead-lifecycle.policy.js';
import { ContactEntity } from '../../src/modules/crm/domain/entities/contact.entity.js';
import { LeadEntity } from '../../src/modules/crm/domain/entities/lead.entity.js';
import { CrmAutomationAdapter } from '../../src/modules/crm/application/services/crm-automation.adapter.js';
import { CrmCommunicationDeliveryService } from '../../src/modules/crm/application/services/crm-communication-delivery.service.js';
import { CrmCommunicationHealthService } from '../../src/modules/crm/application/services/crm-communication-health.service.js';
import { ArticleEntity, RevisionEntity } from '../../src/modules/content/domain/entities/content.entities.js';
import type { ContentService } from '../../src/modules/content/application/content.service.js';
import {
  ArchiveArticleUseCase,
  CreateArticleUseCase,
  DeleteArticleUseCase,
  DuplicateArticleUseCase,
  GetArticleUseCase,
  ListArticlesUseCase,
  ListRevisionsUseCase,
  PublishArticleUseCase,
  RestoreArticleUseCase,
  RestoreRevisionUseCase,
  UnpublishArticleUseCase,
  UpdateArticleUseCase,
} from '../../src/modules/content/application/use-cases/content.use-cases.js';
import { WorkflowValidator } from '../../src/modules/automation/application/validation/workflow-validator.js';
import { MatchingRuleService } from '../../src/modules/property-matching/application/matching-rule.service.js';
import { PropertyPreference } from '../../src/modules/property-matching/domain/property-preference.js';
import { ListingExpiryWorker } from '../../src/modules/property/listing/application/listing-expiry.worker.js';
import { JwtTokenService } from '../../src/modules/auth/application/services/jwt-token.service.js';
import type { CommunicationRecord } from '../../src/modules/crm/domain/repositories/communication.repository.js';
import { PermissionManageAccessGuard, PermissionReadAccessGuard } from '../../src/modules/permissions/security/permission-management-access.guard.js';
import { RoleManageAccessGuard, RoleReadAccessGuard } from '../../src/modules/roles/security/role-management-access.guard.js';

const uuid = '123e4567-e89b-12d3-a456-426614174000';
const now = new Date('2026-01-01T00:00:00.000Z');
const claims: AccessTokenClaims = {
  sub: uuid,
  sid: '1',
  iat: 1_700_000_000,
  exp: 1_800_000_000,
  jti: 'jti-1',
};

const contextOf = (request: unknown, response: unknown = {}): never =>
  ({
    switchToHttp: () => ({
      getRequest: <T>() => request as T,
      getResponse: <T>() => response as T,
    }),
  }) as never;

describe('roadmap final gap coverage', () => {
  it('covers exception mapping and authentication guard outcomes', async () => {
    const logger = { error: vi.fn(), setContext: vi.fn() };
    const config = { getOrThrow: vi.fn().mockReturnValue('test') };
    const filter = new GlobalExceptionFilter(logger as never, config as never);
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const response = {
      status,
      getHeader: vi.fn().mockReturnValue('request-1'),
    };

    filter.catch(new BadRequestException('bad'), contextOf({ path: '/x' }, response));
    filter.catch(new UnauthorizedException('bad'), contextOf({ path: '/x' }, response));
    filter.catch(new Error('boom'), contextOf({ path: '/x', method: 'GET' }, response));
    filter.catch(
      { status: 400, type: 'entity.parse.failed' },
      contextOf({ path: '/x' }, response),
    );
    filter.catch(
      { status: 413, type: 'entity.too.large' },
      contextOf({ path: '/x' }, response),
    );
    expect(status).toHaveBeenCalledTimes(5);
    expect(json).toHaveBeenCalledTimes(5);
    expect(logger.error).toHaveBeenCalled();

    const verifier = { verifyAccessToken: vi.fn() };
    const sessions = { isActive: vi.fn() };
    const guard = new AuthenticatedAccessGuard(verifier as never, sessions as never);
    await expect(guard.canActivate(contextOf({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      guard.canActivate(
        contextOf({ headers: { authorization: 'Bearer ' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    verifier.verifyAccessToken.mockRejectedValueOnce(new Error('invalid'));
    await expect(
      guard.canActivate(
        contextOf({ headers: { authorization: 'Bearer token' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    verifier.verifyAccessToken.mockResolvedValue(claims);
    sessions.isActive.mockResolvedValueOnce(false);
    await expect(
      guard.canActivate(
        contextOf({ headers: { authorization: 'Bearer token' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    sessions.isActive.mockResolvedValue(true);
    const request = { headers: { authorization: 'Bearer token' } };
    await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);
    expect(request).toMatchObject({ user: claims });
  });

  it('covers authorization, property, permission and role access branches', async () => {
    const reflector = { getAllAndOverride: vi.fn() };
    const authorization = {
      resolve: vi.fn().mockResolvedValue({
        userUuid: uuid,
        permissionCodes: ['properties.read'],
        roleCodes: [],
      }),
      assertPermissions: vi.fn(),
      assertRoles: vi.fn(),
    };
    const propertyAccess = { canActivate: vi.fn().mockResolvedValue(true) };
    const authorizationGuard = new AuthorizationGuard(
      reflector as never,
      authorization as never,
      propertyAccess as never,
    );
    reflector.getAllAndOverride.mockReturnValueOnce(true);
    await expect(authorizationGuard.canActivate(contextOf({}))).resolves.toBe(true);
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(
      authorizationGuard.canActivate(contextOf({ user: { sub: uuid } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce({ values: ['properties.read'], match: 'AND' })
      .mockReturnValueOnce(undefined);
    await expect(
      authorizationGuard.canActivate(contextOf({ user: { sub: uuid } })),
    ).resolves.toBe(true);
    authorization.assertPermissions.mockImplementationOnce(() => {
      throw new ForbiddenException();
    });
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce({ values: ['properties.read'], match: 'AND' })
      .mockReturnValueOnce(undefined);
    await expect(
      authorizationGuard.canActivate(contextOf({ user: { sub: uuid } })),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const propertyQuery = {
      canAccessListing: vi.fn().mockResolvedValue(true),
      canAccessProperty: vi.fn().mockResolvedValue(true),
    };
    const propertyGuard = new PropertyAccessGuard(propertyQuery as never);
    await expect(
      propertyGuard.canActivate(
        contextOf({ user: { sub: uuid }, params: {}, path: '/api/v1/health' }),
      ),
    ).resolves.toBe(true);
    await expect(
      propertyGuard.canActivate(
        contextOf({
          user: { sub: uuid },
          params: { uuid: 'listing-1' },
          path: '/api/v1/listings/listing-1',
        }),
      ),
    ).resolves.toBe(true);
    propertyQuery.canAccessListing.mockResolvedValueOnce(false);
    await expect(
      propertyGuard.canActivate(
        contextOf({
          user: { sub: uuid },
          params: { uuid: 'listing-1' },
          path: '/api/v1/listings/listing-1',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      propertyGuard.canActivate(
        contextOf({
          user: { sub: uuid, permissions: ['properties.manage'] },
          params: {},
          path: '/api/v1/properties/property-1',
        }),
      ),
    ).resolves.toBe(true);

    const userAuthorization = {
      getAuthorizationSnapshot: vi.fn().mockResolvedValue({
        userUuid: uuid,
        permissionCodes: ['permissions.read'],
      }),
    };
    const permissionRead = new PermissionReadAccessGuard(userAuthorization as never);
    const permissionManage = new PermissionManageAccessGuard(userAuthorization as never);
    await expect(
      permissionRead.canActivate(contextOf({ user: { sub: uuid } })),
    ).resolves.toBe(true);
    userAuthorization.getAuthorizationSnapshot.mockResolvedValueOnce({
      userUuid: uuid,
      permissionCodes: [],
    });
    await expect(
      permissionRead.canActivate(contextOf({ user: { sub: uuid } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    userAuthorization.getAuthorizationSnapshot.mockResolvedValueOnce(null);
    await expect(
      permissionManage.canActivate(contextOf({ user: { sub: uuid } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const roleAuthorization = {
      getAuthorizationSnapshot: vi.fn().mockResolvedValue({
        userUuid: uuid,
        permissionCodes: ['roles:read'],
      }),
    };
    const roleRead = new RoleReadAccessGuard(roleAuthorization as never);
    const roleManage = new RoleManageAccessGuard(roleAuthorization as never);
    await expect(roleRead.canActivate(contextOf({ user: { sub: uuid } }))).resolves.toBe(true);
    roleAuthorization.getAuthorizationSnapshot.mockResolvedValueOnce({
      userUuid: uuid,
      permissionCodes: ['roles.manage'],
    });
    await expect(roleRead.canActivate(contextOf({ user: { sub: uuid } }))).resolves.toBe(true);
    roleAuthorization.getAuthorizationSnapshot.mockResolvedValueOnce({
      userUuid: uuid,
      permissionCodes: ['roles:manage'],
    });
    await expect(roleManage.canActivate(contextOf({ user: { sub: uuid } }))).resolves.toBe(true);
  });

  it('covers CRM policies, entities and automation adapter mapping', async () => {
    const closure = new ClosurePolicy();
    expect(closure.decide('  sold  ', 'WON')).toEqual({ reason: 'sold', outcome: 'WON' });
    expect(() => closure.decide(' ', 'LOST')).toThrow();

    const lifecycle = new LeadLifecyclePolicy();
    lifecycle.assertCan('QUALIFY', 'NEW');
    lifecycle.assertCan('NURTURE', 'CONTACTED');
    lifecycle.assertCan('REACTIVATE', 'CLOSED_LOST');
    lifecycle.assertCan('CLOSE', 'QUALIFIED');
    expect(() => lifecycle.assertCan('QUALIFY', '')).toThrow();
    expect(() => lifecycle.assertCan('NURTURE', 'CLOSED_WON')).toThrow();
    expect(() => lifecycle.assertCan('REACTIVATE', 'NEW')).toThrow();
    expect(() => lifecycle.assertCan('CLOSE', 'CLOSED_WON')).toThrow();

    const contact = ContactEntity.create({
      uuid,
      firstName: 'John',
      lastName: null,
      displayName: 'John Doe',
      companyName: null,
      jobTitle: null,
      status: 'ACTIVE',
      ownerUserUuid: null,
      source: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    expect(contact.archive(now).status).toBe('ARCHIVED');
    expect(() => contact.archive(now).update({ firstName: 'X' })).toThrow();
    expect(() => ContactEntity.create({ ...contact.toProps(), uuid: 'bad' })).toThrow();

    const lead = LeadEntity.create({
      uuid,
      code: 'L-1',
      contactUuid: uuid,
      sourceUuid: uuid,
      typeUuid: uuid,
      campaignUuid: null,
      status: 'NEW',
      ownerUserUuid: null,
      score: 10,
      scoreVersion: 1,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    expect(lead.withScore(20).scoreVersion).toBe(2);
    expect(lead.assign(null).ownerUserUuid).toBeNull();
    expect(lead.transitionTo('CONTACTED', () => true).status).toBe('CONTACTED');
    expect(() => lead.withScore(-1)).toThrow();
    expect(() => lead.assign('bad')).toThrow();
    expect(() => lead.transitionTo('CLOSED_WON', () => false)).toThrow();

    const crm = {
      getLead: vi.fn().mockResolvedValue({
        contactUuid: uuid,
        status: { code: 'NEW' },
        source: { code: 'WEB' },
        type: { code: 'INBOUND' },
        ownerUserUuid: uuid,
        score: 4,
        createdAt: now,
        updatedAt: now,
        contact: { preferences: { channel: 'EMAIL' } },
      }),
      activityGet: vi.fn().mockResolvedValue({ uuid: 'activity-1' }),
      assign: vi.fn().mockResolvedValue({ uuid: 'lead-1' }),
      recalcScore: vi.fn().mockResolvedValue({ score: 8 }),
      activityCreate: vi.fn().mockResolvedValue({ uuid: 'activity-2' }),
      communicationCreate: vi.fn().mockResolvedValue({ uuid: 'communication-1' }),
      changeStatus: vi.fn().mockResolvedValue({ status: 'QUALIFIED' }),
    };
    const delivery = { deliver: vi.fn().mockResolvedValue({ uuid: 'communication-1' }) };
    const adapter = new CrmAutomationAdapter(crm as never, delivery as never);
    await expect(adapter.getLead(uuid)).resolves.toMatchObject({ status: 'NEW', score: 4 });
    await expect(adapter.getActivity(uuid)).resolves.toEqual({ uuid: 'activity-1' });
    await expect(adapter.getLeadPreferences(uuid)).resolves.toEqual({ channel: 'EMAIL' });
    await expect(
      adapter.assignLead(uuid, uuid, { actorUuid: uuid, permissions: [] }),
    ).resolves.toEqual({ uuid: 'lead-1' });
    await expect(
      adapter.refreshLeadScore(uuid, { actorUuid: uuid, permissions: [] }),
    ).resolves.toEqual({ score: 8 });
    await expect(
      adapter.createActivity({ type: 'CALL' } as never, {
        actorUuid: uuid,
        permissions: [],
      }),
    ).resolves.toEqual({ uuid: 'activity-2' });
    await expect(
      adapter.enqueueCommunication({ channel: 'EMAIL' } as never, {
        actorUuid: uuid,
        permissions: [],
      }),
    ).resolves.toEqual({ uuid: 'communication-1' });
    await expect(
      adapter.deliverCommunication(uuid, { actorUuid: uuid, permissions: [] }),
    ).resolves.toEqual({ uuid: 'communication-1' });
    await expect(
      adapter.changeLeadStatus(uuid, uuid, { actorUuid: uuid, permissions: [] }),
    ).resolves.toEqual({ status: 'QUALIFIED' });
  });

  it('covers communication health and delivery state branches', async () => {
    const communication: CommunicationRecord = {
      uuid: 'communication-1',
      channel: 'EMAIL',
      status: 'SENT',
      providerName: 'provider',
      providerMessageId: 'message-1',
      destination: 'user@example.com',
      subject: 'Hello',
      body: 'Body',
    };
    const repository = {
      findByUuid: vi.fn().mockResolvedValue(communication),
      transitionCommunication: vi.fn().mockResolvedValue(communication),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const service = new CrmCommunicationDeliveryService(
      repository as never,
      audit as never,
      new ConfigService(),
    );
    await expect(service.deliver(communication.uuid)).resolves.toMatchObject({ status: 'SENT' });
    repository.findByUuid.mockResolvedValueOnce(null);
    await expect(service.deliver('missing')).rejects.toBeInstanceOf(NotFoundException);
    repository.findByUuid.mockResolvedValueOnce({ ...communication, status: 'QUEUED' });
    await expect(service.deliver(communication.uuid)).rejects.toBeDefined();

    const noConfig = new CrmCommunicationHealthService(new ConfigService());
    expect(noConfig.status().channels.EMAIL.reason).toBe('provider_not_configured');
    const invalid = new CrmCommunicationHealthService(
      new ConfigService({ email: { providerUrl: 'http://127.0.0.1:8080' } }),
    );
    expect(invalid.status().channels.EMAIL.reason).toBe('invalid_provider_endpoint');
    const valid = new CrmCommunicationHealthService(
      new ConfigService({ email: { providerUrl: 'https://provider.example.com' } }),
    );
    expect(valid.status().channels.EMAIL.reason).toBe('health_check_not_executed');
  });

  it('covers content entities, delegates, workflow validation and matching rules', async () => {
    const article = new ArticleEntity('article-1', 'Title', 'title', { body: 'x' });
    article.transition('IN_REVIEW');
    article.transition('APPROVED');
    article.transition('PUBLISHED');
    article.update({ title: ' Updated ', slug: ' updated ', visibility: 'PRIVATE' });
    expect(article.title).toBe('Updated');
    expect(() => article.transition('IN_REVIEW')).toThrow();
    expect(() => article.update({ title: ' ' })).toThrow();
    expect(() => new RevisionEntity('article', 'id', 0, {}, now)).toThrow();

    const content = {
      createArticle: vi.fn().mockResolvedValue('created'),
      getArticle: vi.fn().mockResolvedValue('got'),
      listArticles: vi.fn().mockResolvedValue('listed'),
      updateArticle: vi.fn().mockResolvedValue('updated'),
      deleteArticle: vi.fn().mockResolvedValue('deleted'),
      restoreArticle: vi.fn().mockResolvedValue('restored'),
      duplicateArticle: vi.fn().mockResolvedValue('duplicated'),
      transitionArticle: vi.fn().mockResolvedValue('transitioned'),
      revisions: vi.fn().mockResolvedValue('revisions'),
      restoreRevision: vi.fn().mockResolvedValue('revision-restored'),
    } as unknown as ContentService;
    const ctx = { actorUuid: uuid };
    await expect(new CreateArticleUseCase(content).execute({}, ctx)).resolves.toBe('created');
    await expect(new GetArticleUseCase(content).execute(uuid)).resolves.toBe('got');
    await expect(new ListArticlesUseCase(content).execute({ limit: 10 })).resolves.toBe('listed');
    await expect(new UpdateArticleUseCase(content).execute(uuid, {}, ctx)).resolves.toBe('updated');
    await expect(new DeleteArticleUseCase(content).execute(uuid, ctx)).resolves.toBe('deleted');
    await expect(new RestoreArticleUseCase(content).execute(uuid, ctx)).resolves.toBe('restored');
    await expect(new DuplicateArticleUseCase(content).execute(uuid, ctx)).resolves.toBe('duplicated');
    await expect(new PublishArticleUseCase(content).execute(uuid, ctx)).resolves.toBe('transitioned');
    await expect(new UnpublishArticleUseCase(content).execute(uuid, ctx)).resolves.toBe('transitioned');
    await expect(new ArchiveArticleUseCase(content).execute(uuid, ctx)).resolves.toBe('transitioned');
    await expect(new ListRevisionsUseCase(content).execute('article', uuid)).resolves.toBe('revisions');
    await expect(
      new RestoreRevisionUseCase(content).execute('article', uuid, '1', ctx),
    ).resolves.toBe('revision-restored');

    const validator = new WorkflowValidator();
    const definition = {
      trigger: { type: 'EVENT', entityType: 'LEAD' },
      graph: {
        nodes: [
          {
            id: 'trigger',
            type: 'TRIGGER',
            trigger: { type: 'EVENT', entityType: 'LEAD' },
          },
          {
            id: 'action',
            type: 'ACTION',
            actionType: 'SEND_COMMUNICATION',
            input: {},
          },
        ],
        edges: [{ from: 'trigger', to: 'action' }],
        entryNodeId: 'trigger',
      },
    };
    expect(validator.validate(definition)).toBe(definition);
    expect(validator.checksum(definition)).toMatch(/^[a-f0-9]{64}$/);
    expect(() => validator.validate(null)).toThrow(BadRequestException);
    expect(() => validator.validate({ ...definition, graph: { ...definition.graph, entryNodeId: 'missing' } })).toThrow();
    expect(() => validator.validate({ ...definition, graph: { ...definition.graph, edges: [{ from: 'action', to: 'action' }] } })).toThrow();

    const ruleRepo = {
      getActive: vi.fn().mockResolvedValue(null),
      get: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      create: vi.fn().mockResolvedValue({ uuid: 'r1', version: 1, isActive: false }),
      update: vi.fn().mockResolvedValue({ uuid: 'r1', version: 2 }),
      activate: vi.fn().mockResolvedValue({ uuid: 'r1', version: 2 }),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const rules = new MatchingRuleService(ruleRepo as never, audit as never);
    expect((await rules.active()).uuid).toBe('default');
    await expect(rules.get('missing')).rejects.toBeInstanceOf(NotFoundException);
    await expect(rules.list()).resolves.toEqual({ items: [], total: 0 });
    await expect(rules.create({ name: 'Rule', createdBy: uuid })).resolves.toMatchObject({ uuid: 'r1' });
    await expect(rules.create({ name: 'bad/name', createdBy: uuid })).rejects.toBeInstanceOf(BadRequestException);
    ruleRepo.get.mockResolvedValueOnce({ uuid: 'r1', version: 2 });
    await expect(rules.update('r1', 1, {}, uuid)).rejects.toBeInstanceOf(ConflictException);
    await expect(rules.activate('r1', uuid)).resolves.toMatchObject({ uuid: 'r1' });

    const preference = PropertyPreference.create({
      transactionTypes: ['SALE'],
      propertyTypeUuids: [uuid],
      propertyCategoryUuids: [uuid],
      location: { latitude: 1, longitude: 2, radiusKm: 5 },
      budget: {
        currency: 'IDR',
        frequency: 'TOTAL',
        min: '100',
        max: '200',
      },
      specification: { bedrooms: { min: 2, max: 4 } },
      hardCriteria: ['transactionType'],
    });
    expect(preference.value.version).toBe(1);
    expect(preference.withVersion(2).value.version).toBe(2);
    expect(() => preference.withVersion(1)).toThrow();
    expect(() => PropertyPreference.create({
      transactionTypes: [],
      propertyTypeUuids: [],
      propertyCategoryUuids: [],
      hardCriteria: [],
    })).toThrow();
    expect(() => PropertyPreference.create({
      transactionTypes: ['SALE'],
      propertyTypeUuids: ['bad'],
      propertyCategoryUuids: [],
      hardCriteria: [],
    })).toThrow();
  });

  it('covers listing expiry worker and JWT signing and verification', async () => {
    vi.useFakeTimers();
    const repository = {
      expireDue: vi.fn().mockResolvedValue(['listing-1', 'listing-2']),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const worker = new ListingExpiryWorker(repository as never, audit as never);
    worker.onModuleInit();
    await Promise.resolve();
    await Promise.resolve();
    expect(repository.expireDue).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledTimes(2);
    worker.onModuleDestroy();
    vi.useRealTimers();

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
        twoFactor: { challengeTtlMs: 300000 },
      },
    });
    const service = new JwtTokenService(new JwtService({ secret }), config);
    const token = await service.issueAccessToken(uuid, '1');
    await expect(service.verifyAccessToken(token)).resolves.toMatchObject({ sub: uuid, sid: '1' });
    await expect(service.verifyAccessToken(`${token}.tampered`)).rejects.toBeInstanceOf(UnauthorizedException);
    const challenge = await service.issueMfaChallenge(uuid, 'challenge-1');
    await expect(service.verifyMfaChallenge(challenge)).resolves.toMatchObject({ challengeId: 'challenge-1' });
    await expect(service.verifyMfaChallenge('invalid')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
