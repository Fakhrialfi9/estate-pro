import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter.js';
import { AuthenticatedAccessGuard } from '../../src/common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../src/common/security/authorization.guard.js';
import { PropertyAccessGuard } from '../../src/common/security/property-access.guard.js';
import { PermissionReadAccessGuard, PermissionManageAccessGuard } from '../../src/modules/permissions/security/permission-management-access.guard.js';
import { RoleReadAccessGuard, RoleManageAccessGuard } from '../../src/modules/roles/security/role-management-access.guard.js';
import { AgentCandidateAdapter } from '../../src/modules/agent-management/application/agent-candidate.adapter.js';
import { CrmAutomationAdapter } from '../../src/modules/crm/application/services/crm-automation.adapter.js';
import { CrmCommunicationDeliveryService } from '../../src/modules/crm/application/services/crm-communication-delivery.service.js';
import { CrmCommunicationHealthService } from '../../src/modules/crm/application/services/crm-communication-health.service.js';
import { ClosurePolicy } from '../../src/modules/crm/domain/closure.policy.js';
import { LeadLifecyclePolicy } from '../../src/modules/crm/domain/lead-lifecycle.policy.js';
import { LeadEntity } from '../../src/modules/crm/domain/entities/lead.entity.js';
import { ContactEntity } from '../../src/modules/crm/domain/entities/contact.entity.js';
import { ArticleEntity, RevisionEntity } from '../../src/modules/content/domain/entities/content.entities.js';
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
  ContentRelationUseCase,
  ContentResourceUseCase,
  MediaUseCase,
  EngagementUseCase,
} from '../../src/modules/content/application/use-cases/content.use-cases.js';
import { WorkflowValidator } from '../../src/modules/automation/application/validation/workflow-validator.js';
import { MatchingRuleService } from '../../src/modules/property-matching/application/matching-rule.service.js';
import { PropertyPreference } from '../../src/modules/property-matching/domain/property-preference.js';
import { PropertyMatchingService } from '../../src/modules/property-matching/application/property-matching.service.js';
import { ListingExpiryWorker } from '../../src/modules/property/listing/application/listing-expiry.worker.js';
import { JwtTokenService } from '../../src/modules/auth/application/services/jwt-token.service.js';
import { AuditLogService } from '../../src/modules/audit/application/audit-log.service.js';
import { AuditLogEntity } from '../../src/modules/audit/domain/entities/audit-log.entity.js';
import type { AccessTokenClaims } from '../../src/common/security/access-token-verifier.port.js';
import type { ContentService } from '../../src/modules/content/application/content.service.js';
import type { CommunicationRecord } from '../../src/modules/crm/domain/repositories/communication.repository.js';
import { CommunicationProviderError } from '../../src/modules/crm/infrastructure/providers/communication-provider.js';

const uuid = '123e4567-e89b-12d3-a456-426614174000';
const now = new Date('2026-01-01T00:00:00.000Z');
const claims: AccessTokenClaims = {
  sub: uuid,
  sid: '1',
  iat: 1_700_000_000,
  exp: 1_800_000_000,
  jti: 'jti-1',
};

const httpContext = (request: unknown, response: unknown = {}) =>
  ({
    switchToHttp: () => ({
      getRequest: <T>() => request as T,
      getResponse: <T>() => response as T,
    }),
  }) as never;

describe('roadmap final gap coverage', () => {
  it('covers global exception filter mapping and logging fallbacks', () => {
    const logger = { error: vi.fn(), setContext: vi.fn() };
    const config = { getOrThrow: vi.fn().mockReturnValue('test') };
    const filter = new GlobalExceptionFilter(logger as never, config as never);
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const response = { status, getHeader: vi.fn().mockReturnValue('req-1') };
    const request = { path: '/test', method: 'GET' };

    filter.catch(new BadRequestException('bad'), httpContext(request, response));
    filter.catch(new UnauthorizedException('unauthorized'), httpContext(request, response));
    filter.catch(new Error('boom'), httpContext(request, response));
    filter.catch({ status: 400, type: 'entity.parse.failed' }, httpContext(request, response));
    filter.catch({ status: 413, type: 'entity.too.large' }, httpContext(request, response));

    expect(status).toHaveBeenCalled();
    expect(json).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('covers authenticated and authorization guard failure branches', async () => {
    const verifier = { verifyAccessToken: vi.fn() };
    const sessions = { isActive: vi.fn() };
    const authenticated = new AuthenticatedAccessGuard(
      verifier as never,
      sessions as never,
    );
    const request = { headers: { authorization: `Bearer token` } };
    const context = httpContext(request);

    await expect(authenticated.canActivate(httpContext({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(authenticated.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    verifier.verifyAccessToken.mockRejectedValueOnce(new Error('invalid'));
    await expect(authenticated.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    verifier.verifyAccessToken.mockResolvedValueOnce(claims);
    sessions.isActive.mockResolvedValueOnce(false);
    await expect(authenticated.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    verifier.verifyAccessToken.mockResolvedValueOnce(claims);
    sessions.isActive.mockResolvedValueOnce(true);
    await expect(authenticated.canActivate(context)).resolves.toBe(true);

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
    const guard = new AuthorizationGuard(
      reflector as never,
      authorization as never,
      propertyAccess as never,
    );
    reflector.getAllAndOverride.mockReturnValueOnce(true);
    await expect(guard.canActivate(httpContext({ user: { sub: uuid } }))).resolves.toBe(true);
    reflector.getAllAndOverride.mockReset();
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(httpContext({ user: { sub: uuid } }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce({ values: ['properties.read'], match: 'AND' })
      .mockReturnValueOnce(undefined);
    await expect(guard.canActivate(httpContext({ user: { sub: uuid } }))).resolves.toBe(true);
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce({ values: ['properties.read'], match: 'AND' })
      .mockReturnValueOnce(undefined);
    authorization.assertPermissions.mockImplementationOnce(() => {
      throw new ForbiddenException();
    });
    await expect(guard.canActivate(httpContext({ user: { sub: uuid } }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('covers property access, permission access and role access matrices', async () => {
    const propertyQuery = {
      canAccessListing: vi.fn().mockResolvedValue(true),
      canAccessProperty: vi.fn().mockResolvedValue(true),
    };
    const propertyGuard = new PropertyAccessGuard(propertyQuery as never);
    const user = { sub: uuid, permissions: [] as string[] };
    await expect(propertyGuard.canActivate(httpContext({ user, params: {}, path: '/api/v1/health' }))).resolves.toBe(true);
    await expect(
      propertyGuard.canActivate(
        httpContext({ user, params: { uuid: 'x' }, path: '/api/v1/listings/x' }),
      ),
    ).resolves.toBe(true);
    propertyQuery.canAccessListing.mockResolvedValueOnce(false);
    await expect(
      propertyGuard.canActivate(
        httpContext({ user, params: { uuid: 'x' }, path: '/api/v1/listings/x' }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      propertyGuard.canActivate(
        httpContext({ user: { sub: uuid, permissions: ['properties.manage'] }, params: {}, path: '/api/v1/properties/x' }),
      ),
    ).resolves.toBe(true);

    const authorization = {
      getAuthorizationSnapshot: vi.fn().mockResolvedValue({
        userUuid: uuid,
        permissionCodes: ['permissions.read'],
      }),
    };
    const read = new PermissionReadAccessGuard(authorization as never);
    const manage = new PermissionManageAccessGuard(authorization as never);
    await expect(read.canActivate(httpContext({ user: { sub: uuid } }))).resolves.toBe(true);
    authorization.getAuthorizationSnapshot.mockResolvedValueOnce({ userUuid: uuid, permissionCodes: [] });
    await expect(read.canActivate(httpContext({ user: { sub: uuid } }))).rejects.toBeInstanceOf(ForbiddenException);
    authorization.getAuthorizationSnapshot.mockResolvedValueOnce({ userUuid: uuid, permissionCodes: ['permissions.manage'] });
    await expect(read.canActivate(httpContext({ user: { sub: uuid } }))).resolves.toBe(true);
    authorization.getAuthorizationSnapshot.mockResolvedValueOnce(null);
    await expect(manage.canActivate(httpContext({ user: { sub: uuid } }))).rejects.toBeInstanceOf(UnauthorizedException);

    const roleAuthorization = {
      getAuthorizationSnapshot: vi.fn().mockResolvedValue({
        userUuid: uuid,
        permissionCodes: ['roles:read'],
      }),
    };
    const roleRead = new RoleReadAccessGuard(roleAuthorization as never);
    const roleManage = new RoleManageAccessGuard(roleAuthorization as never);
    await expect(roleRead.canActivate(httpContext({ user: { sub: uuid } }))).resolves.toBe(true);
    roleAuthorization.getAuthorizationSnapshot.mockResolvedValueOnce({ userUuid: uuid, permissionCodes: [] });
    await expect(roleRead.canActivate(httpContext({ user: { sub: uuid } }))).rejects.toBeInstanceOf(ForbiddenException);
    roleAuthorization.getAuthorizationSnapshot.mockResolvedValueOnce({ userUuid: uuid, permissionCodes: ['roles.manage'] });
    await expect(roleRead.canActivate(httpContext({ user: { sub: uuid } }))).resolves.toBe(true);
    roleAuthorization.getAuthorizationSnapshot.mockResolvedValueOnce({ userUuid: uuid, permissionCodes: ['roles:manage'] });
    await expect(roleManage.canActivate(httpContext({ user: { sub: uuid } }))).resolves.toBe(true);
  });

  it('covers agent adapter, CRM policies, entities and communication adapters', async () => {
    const agents = { findCandidates: vi.fn().mockResolvedValue([{ uuid: 'agent-1' }]) };
    const adapter = new AgentCandidateAdapter(agents as never);
    await expect(adapter.findCandidates({ regionUuid: uuid }, uuid)).resolves.toEqual([{ uuid: 'agent-1' }]);
    expect(agents.findCandidates).toHaveBeenCalledWith({ regionUuid: uuid }, { uuid });
    await adapter.findCandidates({ regionUuid: uuid });

    const closure = new ClosurePolicy();
    expect(closure.decide('  reason  ', 'WON')).toEqual({ reason: 'reason', outcome: 'WON' });
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
      displayName: 'John',
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
    expect(() => contact.update({ firstName: 'X' })).not.toThrow();
    expect(() => contact.archive(now).update({ firstName: 'X' })).toThrow();
    expect(() => ContactEntity.create({ ...contact.toProps(), uuid: 'x' })).toThrow();
    expect(() => ContactEntity.create({ ...contact.toProps(), status: 'ARCHIVED', archivedAt: null })).toThrow();

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
    expect(lead.assign(null).ownerUserUuid).toBeNull();
    expect(lead.withScore(20).scoreVersion).toBe(2);
    expect(lead.transitionTo('CONTACTED', () => true).status).toBe('CONTACTED');
    expect(() => lead.assign('bad')).toThrow();
    expect(() => lead.withScore(-1)).toThrow();
    expect(() => lead.transitionTo('CLOSED_WON', () => false)).toThrow();
    expect(() => LeadEntity.create({ ...lead.toProps(), scoreVersion: 0 })).toThrow();

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
      communicationCreate: vi.fn().mockResolvedValue({ uuid: 'comm-1' }),
      changeStatus: vi.fn().mockResolvedValue({ status: 'QUALIFIED' }),
    };
    const delivery = { deliver: vi.fn().mockResolvedValue({ uuid: 'comm-1' }) };
    const automation = new CrmAutomationAdapter(crm as never, delivery as never);
    await expect(automation.getLead(uuid)).resolves.toMatchObject({ contactUuid: uuid, status: 'NEW', score: 4 });
    await expect(automation.getActivity(uuid)).resolves.toEqual({ uuid: 'activity-1' });
    await expect(automation.getLeadPreferences(uuid)).resolves.toEqual({ channel: 'EMAIL' });
    await expect(automation.assignLead(uuid, uuid, { actorUuid: uuid, permissions: [] })).resolves.toEqual({ uuid: 'lead-1' });
    await expect(automation.refreshLeadScore(uuid, { actorUuid: uuid, permissions: [] })).resolves.toEqual({ score: 8 });
    await expect(automation.createActivity({ type: 'CALL' }, { actorUuid: uuid, permissions: [] })).resolves.toEqual({ uuid: 'activity-2' });
    await expect(automation.enqueueCommunication({ channel: 'EMAIL' }, { actorUuid: uuid, permissions: [] })).resolves.toEqual({ uuid: 'comm-1' });
    await expect(automation.deliverCommunication(uuid, { actorUuid: uuid, permissions: [] })).resolves.toEqual({ uuid: 'comm-1' });
    await expect(automation.changeLeadStatus(uuid, uuid, { actorUuid: uuid, permissions: [] })).resolves.toEqual({ status: 'QUALIFIED' });

    const communication: CommunicationRecord = {
      uuid: 'comm-1',
      channel: 'EMAIL',
      status: 'SENT',
      providerName: 'test',
      providerMessageId: 'provider-1',
      destination: 'john@example.com',
      subject: 'Hi',
      body: 'Hello',
    };
    const repository = {
      findByUuid: vi.fn().mockResolvedValue(communication),
      transitionCommunication: vi.fn().mockResolvedValue(communication),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const config = new ConfigService({
      email: { providerUrl: 'https://provider.example.com' },
      EMAIL_PROVIDER_URL: undefined,
    });
    const deliveryService = new CrmCommunicationDeliveryService(
      repository as never,
      audit as never,
      config,
    );
    await expect(deliveryService.deliver('comm-1', uuid)).resolves.toMatchObject({ status: 'SENT' });
    repository.findByUuid.mockResolvedValueOnce(null);
    await expect(deliveryService.deliver('missing', uuid)).rejects.toBeInstanceOf(NotFoundException);

    const healthNoConfig = new CrmCommunicationHealthService(new ConfigService());
    expect(healthNoConfig.status().channels.EMAIL.reason).toBe('provider_not_configured');
    const healthInvalid = new CrmCommunicationHealthService(
      new ConfigService({ email: { providerUrl: 'http://127.0.0.1:9000' } }),
    );
    expect(healthInvalid.status().channels.EMAIL.reason).toBe('invalid_provider_endpoint');
  });

  it('covers content entities and all thin content use-case delegates', async () => {
    const article = new ArticleEntity('article-1', 'Title', 'title', { body: 'x' });
    expect(article.status).toBe('DRAFT');
    article.transition('IN_REVIEW');
    article.transition('APPROVED');
    article.transition('PUBLISHED');
    article.update({ title: ' Updated ', slug: ' updated ', visibility: 'PRIVATE', content: { body: 'y' } });
    expect(article.title).toBe('Updated');
    expect(article.visibility).toBe('PRIVATE');
    expect(() => article.transition('IN_REVIEW')).toThrow();
    expect(() => article.update({ title: ' ' })).toThrow();
    expect(() => article.update({ slug: ' ' })).toThrow();
    expect(() => new RevisionEntity('article', 'id', 0, {}, now)).toThrow();
    expect(new RevisionEntity('article', 'id', 1, {}, now).version).toBe(1);

    const service = {
      createArticle: vi.fn().mockResolvedValue('create'),
      getArticle: vi.fn().mockResolvedValue('get'),
      listArticles: vi.fn().mockResolvedValue('list'),
      updateArticle: vi.fn().mockResolvedValue('update'),
      deleteArticle: vi.fn().mockResolvedValue('delete'),
      restoreArticle: vi.fn().mockResolvedValue('restore'),
      duplicateArticle: vi.fn().mockResolvedValue('duplicate'),
      transitionArticle: vi.fn().mockResolvedValue('transition'),
      revisions: vi.fn().mockResolvedValue('revisions'),
      restoreRevision: vi.fn().mockResolvedValue('restore-revision'),
      listResource: vi.fn().mockResolvedValue('resource-list'),
      getResource: vi.fn().mockResolvedValue('resource-get'),
      createResource: vi.fn().mockResolvedValue('resource-create'),
      updateResource: vi.fn().mockResolvedValue('resource-update'),
      deleteResource: vi.fn().mockResolvedValue('resource-delete'),
      restoreResource: vi.fn().mockResolvedValue('resource-restore'),
      createMedia: vi.fn().mockResolvedValue('media-create'),
      removeMedia: vi.fn().mockResolvedValue('media-remove'),
      interaction: vi.fn().mockResolvedValue('interaction'),
      view: vi.fn().mockResolvedValue('view'),
      commentCreate: vi.fn().mockResolvedValue('comment-create'),
      commentModerate: vi.fn().mockResolvedValue('comment-moderate'),
    } as unknown as ContentService;
    const context = { actorUuid: uuid };
    await expect(new CreateArticleUseCase(service).execute({}, context)).resolves.toBe('create');
    await expect(new GetArticleUseCase(service).execute(uuid)).resolves.toBe('get');
    await expect(new ListArticlesUseCase(service).execute({ limit: 10 })).resolves.toBe('list');
    await expect(new UpdateArticleUseCase(service).execute(uuid, {}, context)).resolves.toBe('update');
    await expect(new DeleteArticleUseCase(service).execute(uuid, context)).resolves.toBe('delete');
    await expect(new RestoreArticleUseCase(service).execute(uuid, context)).resolves.toBe('restore');
    await expect(new DuplicateArticleUseCase(service).execute(uuid, context)).resolves.toBe('duplicate');
    await expect(new PublishArticleUseCase(service).execute(uuid, context)).resolves.toBe('transition');
    await expect(new UnpublishArticleUseCase(service).execute(uuid, context)).resolves.toBe('transition');
    await expect(new ArchiveArticleUseCase(service).execute(uuid, context)).resolves.toBe('transition');
    await expect(new ListRevisionsUseCase(service).execute('article', uuid)).resolves.toBe('revisions');
    await expect(new RestoreRevisionUseCase(service).execute('article', uuid, '1', context)).resolves.toBe('restore-revision');
    const resource = new ContentResourceUseCase(service);
    await expect(resource.list('page', { limit: 10 })).resolves.toBe('resource-list');
    await expect(resource.get('page', uuid)).resolves.toBe('resource-get');
    await expect(resource.create('page', {}, context)).resolves.toBe('resource-create');
    await expect(resource.update('page', uuid, {}, context)).resolves.toBe('resource-update');
    await expect(resource.delete('page', uuid, context)).resolves.toBe('resource-delete');
    await expect(resource.restore('page', uuid, context)).resolves.toBe('resource-restore');
    const relationRepository = {
      addRelation: vi.fn().mockResolvedValue('add'),
      listRelations: vi.fn().mockResolvedValue('list-relations'),
      removeRelation: vi.fn().mockResolvedValue('remove-relations'),
    };
    const relation = new ContentRelationUseCase(relationRepository as never);
    await expect(relation.add({}, context)).resolves.toBe('add');
    await expect(relation.list(uuid)).resolves.toBe('list-relations');
    await expect(relation.remove(uuid, context)).resolves.toBe('remove-relations');
    const media = new MediaUseCase(service);
    await expect(media.create({ originalname: 'a', mimetype: 'image/jpeg', size: 1, buffer: Buffer.from('x') }, {}, context, 'key', null)).resolves.toBe('media-create');
    await expect(media.remove(uuid, context)).resolves.toBe('media-remove');
    const engagement = new EngagementUseCase(service);
    await expect(engagement.toggle('like', uuid, uuid, context)).resolves.toBe('interaction');
    await expect(engagement.view(uuid, '127.0.0.1')).resolves.toBe('view');
    await expect(engagement.comment(uuid, {}, context)).resolves.toBe('comment-create');
    await expect(engagement.moderate(uuid, 'APPROVED', undefined, context)).resolves.toBe('comment-moderate');
  });

  it('covers workflow validation branches and matching domain/application branches', async () => {
    const validator = new WorkflowValidator();
    const trigger = { id: 'trigger', type: 'TRIGGER', trigger: { type: 'EVENT', entityType: 'LEAD' } };
    const action = { id: 'action', type: 'ACTION', actionType: 'SEND_COMMUNICATION', input: {}, maxAttempts: 3, timeoutMs: 1000 };
    const definition = {
      trigger: { type: 'EVENT', entityType: 'LEAD' },
      graph: { nodes: [trigger, action], edges: [{ from: 'trigger', to: 'action' }], entryNodeId: 'trigger' },
    };
    expect(validator.validate(definition)).toBe(definition);
    expect(validator.checksum(definition)).toMatch(/^[a-f0-9]{64}$/);
    expect(() => validator.validate(null)).toThrow(BadRequestException);
    expect(() => validator.validate({ trigger: {}, graph: {} })).toThrow();
    expect(() => validator.validate({ ...definition, graph: { ...definition.graph, entryNodeId: 'missing' } })).toThrow();
    expect(() => validator.validate({ ...definition, graph: { ...definition.graph, edges: [{ from: 'action', to: 'action' }] } })).toThrow();
    const condition = {
      id: 'condition',
      type: 'CONDITION',
      operator: 'ALL',
      operands: [{ field: 'status', operator: 'EQUALS', expected: 'NEW', source: 'CRM' }],
    };
    const conditionDefinition = {
      trigger: { type: 'EVENT', entityType: 'LEAD' },
      graph: { nodes: [trigger, condition], edges: [{ from: 'trigger', to: 'condition' }], entryNodeId: 'trigger' },
    };
    expect(validator.validate(conditionDefinition)).toBe(conditionDefinition);

    const ruleRepo = {
      getActive: vi.fn().mockResolvedValue(null),
      get: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      create: vi.fn().mockResolvedValue({ uuid: 'r1', version: 1, isActive: false }),
      update: vi.fn().mockResolvedValue({ uuid: 'r1', version: 2 }),
      activate: vi.fn().mockResolvedValue({ uuid: 'r1', version: 2 }),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const ruleService = new MatchingRuleService(ruleRepo as never, audit as never);
    expect((await ruleService.active()).uuid).toBe('default');
    await expect(ruleService.get('missing')).rejects.toBeInstanceOf(NotFoundException);
    await expect(ruleService.list()).resolves.toEqual({ items: [], total: 0 });
    await expect(ruleService.create({ name: 'Rule', createdBy: uuid })).resolves.toMatchObject({ uuid: 'r1' });
    await expect(ruleService.create({ name: 'bad/name', createdBy: uuid })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ruleService.create({ name: 'Rule', createdBy: uuid, weights: { location: -1 } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ruleService.update('missing', 1, {}, uuid)).rejects.toBeInstanceOf(NotFoundException);
    ruleRepo.get.mockResolvedValueOnce({ uuid: 'r1', version: 3 });
    await expect(ruleService.update('r1', 1, {}, uuid)).rejects.toBeInstanceOf(ConflictException);
    ruleRepo.get.mockResolvedValueOnce({ uuid: 'r1', version: 3 });
    await expect(ruleService.update('r1', 3, { minimumScore: 101 }, uuid)).rejects.toBeInstanceOf(BadRequestException);
    await expect(ruleService.activate('r1', uuid)).resolves.toMatchObject({ uuid: 'r1' });

    const preferenceBase = {
      transactionTypes: ['SALE'] as const,
      propertyTypeUuids: [uuid] as const,
      propertyCategoryUuids: [uuid] as const,
      location: { latitude: 1, longitude: 2, radiusKm: 5 },
      budget: { currency: 'IDR', frequency: 'TOTAL' as const, min: '100', max: '200' },
      specification: { bedrooms: { min: 2, max: 4 } },
      hardCriteria: ['transactionType'] as const,
    };
    const preference = PropertyPreference.create(preferenceBase);
    expect(preference.value.version).toBe(1);
    expect(preference.withVersion(2).value.version).toBe(2);
    expect(() => preference.withVersion(1)).toThrow();
    expect(() => PropertyPreference.create({ ...preferenceBase, transactionTypes: [], hardCriteria: ['transactionType'] })).toThrow();
    expect(() => PropertyPreference.create({ ...preferenceBase, propertyTypeUuids: ['bad'] })).toThrow();
    expect(() => PropertyPreference.create({ ...preferenceBase, budget: { ...preferenceBase.budget, currency: 'idr' } })).toThrow();
    expect(() => PropertyPreference.create({ ...preferenceBase, location: { latitude: 1 } })).toThrow();
    expect(() => PropertyPreference.create({ ...preferenceBase, location: { latitude: 91, longitude: 2 } })).toThrow();

    const repository = {
      findPreference: vi.fn().mockResolvedValue(null),
      createPreference: vi.fn().mockResolvedValue({ version: 1 }),
      restorePreference: vi.fn().mockResolvedValue({ version: 2 }),
      updatePreference: vi.fn().mockResolvedValue({ version: 2 }),
      archivePreference: vi.fn().mockResolvedValue({ version: 2 }),
      getPreferenceSubjectScope: vi.fn().mockResolvedValue({ ownerUserUuid: uuid }),
      listCandidates: vi.fn().mockResolvedValue([]),
      getSignals: vi.fn().mockResolvedValue([]),
      saveRecommendation: vi.fn().mockResolvedValue({ uuid: 'rec-1' }),
      getLatestRecommendation: vi.fn().mockResolvedValue(null),
      listRecommendationHistory: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      recordFeedback: vi.fn().mockResolvedValue({ uuid: 'feedback-1' }),
      listSavedListings: vi.fn().mockResolvedValue([]),
    };
    const engine = { evaluate: vi.fn().mockReturnValue([]) };
    const rules = { active: vi.fn().mockResolvedValue({ version: 1, minimumScore: 0 }) };
    const authorization = { resolve: vi.fn().mockResolvedValue({ permissionCodes: ['crm.leads.read'] }), assertPermissions: vi.fn() };
    const matching = new PropertyMatchingService(repository as never, engine as never, rules as never, authorization as never, audit as never);
    const actor = { actorUuid: uuid, permissions: [] };
    await expect(matching.createPreference('USER', uuid, preferenceBase, actor)).resolves.toEqual({ version: 1 });
    await expect(matching.getPreference('USER', uuid, actor)).rejects.toBeInstanceOf(NotFoundException);
    await expect(matching.match('USER', uuid, {}, actor)).rejects.toBeInstanceOf(NotFoundException);
    await expect(matching.getLatest('USER', uuid, actor)).rejects.toBeInstanceOf(NotFoundException);
    await expect(matching.history('USER', uuid, 1, 20, actor)).rejects.toBeDefined();
  });

  it('covers listing expiry worker lifecycle and audit behavior', async () => {
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
  });

  it('covers audit log write sanitization and repository failure isolation', async () => {
    const repository = {
      record: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({
        total: 1,
        items: [
          new AuditLogEntity({
            uuid: 'audit-1',
            actorUuid: uuid,
            actorType: 'USER',
            subjectUuid: uuid,
            action: 'LOGIN',
            resourceType: 'authentication',
            resourceId: '1',
            result: 'SUCCESS',
            reason: null,
            ipAddress: '127.0.0.1',
            userAgent: 'test',
            requestId: 'req-1',
            createdAt: now,
            changes: [],
          }),
        ],
      }),
    };
    const logger = { setContext: vi.fn(), error: vi.fn() };
    const service = new AuditLogService(repository as never, logger as never);
    await service.record({ action: 'LOGIN', entityType: 'authentication', reason: 'password=secret', changes: { password: 'secret' } });
    expect(repository.record).toHaveBeenCalled();
    repository.record.mockRejectedValueOnce(new Error('storage')); 
    await expect(service.record({ action: 'LOGIN' })).resolves.toBeUndefined();
    await expect(service.list({})).resolves.toMatchObject({ total: 1, items: [{ uuid: 'audit-1' }] });
  });

  it('covers JWT verification rejection and configured algorithm constraints', async () => {
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
    const jwt = new JwtService({ secret });
    const service = new JwtTokenService(jwt, config);
    const token = await service.issueAccessToken(uuid, '1');
    await expect(service.verifyAccessToken(token)).resolves.toMatchObject({ sub: uuid, sid: '1' });
    await expect(service.verifyAccessToken(`${token}.tampered`)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.verifyAccessToken('invalid')).rejects.toBeInstanceOf(UnauthorizedException);
    const challenge = await service.issueMfaChallenge(uuid, 'challenge-1');
    await expect(service.verifyMfaChallenge(challenge)).resolves.toMatchObject({ sub: uuid, challengeId: 'challenge-1' });
    await expect(service.verifyMfaChallenge('invalid')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
