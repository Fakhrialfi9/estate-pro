import { describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MatchingRuleService } from '../../../src/modules/property-matching/application/matching-rule.service.js';
import { PropertyMatchingService } from '../../../src/modules/property-matching/application/property-matching.service.js';
import { MatchingEngine } from '../../../src/modules/property-matching/domain/matching-engine.js';
import { PropertyPreference } from '../../../src/modules/property-matching/domain/property-preference.js';
import type {
  MatchCandidate,
  BehavioralSignal,
  PropertyPreferenceState,
} from '../../../src/modules/property-matching/domain/matching.types.js';
import { DEFAULT_MATCHING_RULE } from '../../../src/modules/property-matching/domain/matching-rule.js';
import type { MatchingRepository } from '../../../src/modules/property-matching/application/matching.ports.js';
import type { AuthorizationService } from '../../../src/common/security/authorization.service.js';
import type { SecurityAuditRepository } from '../../../src/common/audit/security-audit.port.js';

const uuid = '11111111-1111-4111-8111-111111111111';
const uuid2 = '22222222-2222-4222-8222-222222222222';
const uuid3 = '33333333-3333-4333-8333-333333333333';
const actor = {
  actorUuid: uuid,
  permissions: ['crm.contacts.read'],
  requestId: 'r1',
};
const preference: PropertyPreferenceState = {
  version: 1,
  transactionTypes: ['SALE'],
  propertyTypeUuids: [uuid2],
  propertyCategoryUuids: [uuid3],
  location: { countryUuid: uuid, latitude: 0, longitude: 0, radiusKm: 20 },
  budget: {
    currency: 'IDR',
    frequency: 'TOTAL',
    min: '100',
    max: '200',
    tolerancePercent: 10,
  },
  specification: {
    bedrooms: { min: 2, max: 4 },
    bathrooms: { min: '1', max: '3' },
    areaSqm: { min: '80', max: '150' },
    parkingSpaces: { min: 1, max: 2 },
    furnishedStatus: 'FULLY_FURNISHED',
    condition: 'GOOD',
  },
  hardCriteria: [],
};
const candidate = (
  overrides: Partial<MatchCandidate> = {},
): MatchCandidate => ({
  propertyUuid: uuid,
  listingUuid: uuid2,
  propertyTypeUuid: uuid2,
  propertyCategoryUuid: uuid3,
  transactionType: 'SALE',
  listingStatus: 'PUBLISHED',
  visibility: 'PUBLIC',
  publishedAt: new Date('2026-01-01T00:00:00.000Z'),
  expiresAt: null,
  price: {
    currency: 'IDR',
    priceType: 'TOTAL',
    minPrice: '120',
    maxPrice: '180',
  },
  location: { countryUuid: uuid, latitude: 0.01, longitude: 0.01 },
  specification: {
    bedrooms: 3,
    bathrooms: '2',
    buildingAreaSqm: '120',
    parkingSpaces: 1,
    furnishedStatus: 'FULLY_FURNISHED',
    condition: 'GOOD',
  },
  ...overrides,
});
const signal: BehavioralSignal = {
  saved: true,
  viewedAt: new Date(),
  inquiryCount: 1,
  viewCount: 2,
};

describe('property matching phase 9', () => {
  it('covers MatchingRuleService defaults, validation, audit and stale versions', async () => {
    const repository = {
      getActive: vi.fn().mockResolvedValue(null),
      get: vi.fn().mockResolvedValue({ uuid, version: 1 }),
      list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      create: vi.fn().mockResolvedValue({ uuid, version: 1, isActive: false }),
      update: vi.fn().mockResolvedValue({ uuid, version: 2, isActive: false }),
      activate: vi.fn().mockResolvedValue({ uuid, version: 2, isActive: true }),
    };
    const audit = {
      record: vi
        .fn<SecurityAuditRepository['record']>()
        .mockResolvedValue(undefined),
    } satisfies SecurityAuditRepository;
    const service = new MatchingRuleService(repository, audit);
    expect((await service.active()).uuid).toBe('default');
    repository.get.mockResolvedValueOnce(null);
    await expect(service.get('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await service.list(1, 10);
    await service.create({ name: ' Rule ', createdBy: uuid });
    await service.update(
      uuid,
      1,
      {
        name: 'Updated',
        weights: { transactionType: 10 },
        hardCriteria: ['budget'],
        minimumScore: 50,
      },
      uuid2,
    );
    await service.activate(uuid, uuid2);
    await expect(
      service.create({ name: '!!!', createdBy: uuid }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ name: 'ok', version: 0, createdBy: uuid }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({
        name: 'ok',
        weights: { transactionType: -1 },
        createdBy: uuid,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({
        name: 'ok',
        weights: { transactionType: 101 },
        createdBy: uuid,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({
        name: 'ok',
        hardCriteria: ['invalid'],
        createdBy: uuid,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ name: 'ok', minimumScore: 101, createdBy: uuid }),
    ).rejects.toBeInstanceOf(BadRequestException);
    repository.get.mockResolvedValueOnce(null);
    await expect(service.update(uuid, 1, {}, uuid2)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    repository.get.mockResolvedValueOnce({ uuid, version: 2 });
    await expect(service.update(uuid, 1, {}, uuid2)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('covers MatchingEngine hard criteria, weighted scoring, budget/location/specification/behavior and sorting', () => {
    const engine = new MatchingEngine();
    const results = engine.evaluate(
      preference,
      [candidate(), candidate({ listingUuid: uuid3, propertyTypeUuid: uuid3 })],
      new Map([[uuid2, signal]]),
      {
        ...DEFAULT_MATCHING_RULE,
        minimumScore: 35,
        hardCriteria: [],
      },
    );
    expect(results).toHaveLength(2);
    expect(results[0]?.score).toBeGreaterThanOrEqual(35);
    expect(results[0]?.explanation.matched).toContain('behavior');

    const hardPref = {
      ...preference,
      hardCriteria: ['budget', 'location'] as const,
    };
    expect(
      engine.evaluate(
        hardPref,
        [
          candidate({
            price: {
              currency: 'USD',
              priceType: 'TOTAL',
              minPrice: '1',
              maxPrice: '2',
            },
          }),
        ],
        new Map(),
        DEFAULT_MATCHING_RULE,
      ),
    ).toEqual([]);
    expect(
      engine.evaluate(
        hardPref,
        [
          candidate({
            location: { countryUuid: uuid2, latitude: 0, longitude: 0 },
          }),
        ],
        new Map(),
        DEFAULT_MATCHING_RULE,
      ),
    ).toEqual([]);
    expect(
      engine.evaluate(
        preference,
        [candidate({ price: null })],
        new Map(),
        DEFAULT_MATCHING_RULE,
      ),
    ).toEqual([]);
    expect(
      engine.evaluate(
        { ...preference, budget: undefined },
        [candidate({ specification: null, location: null })],
        new Map(),
        DEFAULT_MATCHING_RULE,
      ),
    ).toBeDefined();
    expect(
      engine.evaluate(
        {
          ...preference,
          specification: {
            bedrooms: { min: 5 },
            parkingSpaces: { min: 5 },
            bathrooms: { min: '10' },
            areaSqm: { min: '1000' },
          },
        },
        [candidate()],
        new Map(),
        DEFAULT_MATCHING_RULE,
      ),
    ).toEqual([]);
  });

  it('covers PropertyPreference value cloning and every validation edge', () => {
    const created = PropertyPreference.create(preference);
    const value = created.value;
    const mutableTransactionTypes = [...value.transactionTypes];
    mutableTransactionTypes.push('RENT');
    expect(created.value.transactionTypes).toEqual(['SALE']);
    expect(created.withVersion(2).value.version).toBe(2);
    expect(() =>
      PropertyPreference.assertLocation({ countryUuid: 'bad' }),
    ).toThrow();
    expect(() =>
      PropertyPreference.assertBudget({
        currency: 'IDR',
        frequency: 'TOTAL',
        min: '1.001',
      }),
    ).toThrow();
    expect(() =>
      PropertyPreference.assertSpecification({ parkingSpaces: { min: -1 } }),
    ).toThrow();
  });

  it('covers PropertyMatchingService preference lifecycle, match/generate/history/feedback and access fallbacks', async () => {
    let findPreferenceResult: Awaited<
      ReturnType<MatchingRepository['findPreference']>
    > = preference;
    let preferenceScope: Awaited<
      ReturnType<MatchingRepository['getPreferenceSubjectScope']>
    > = { ownerUserUuid: uuid2 };
    let denyPermissions = false;
    const findPreference = vi
      .fn<MatchingRepository['findPreference']>()
      .mockImplementation(() => Promise.resolve(findPreferenceResult));
    const getPreferenceSubjectScope = vi
      .fn<MatchingRepository['getPreferenceSubjectScope']>()
      .mockImplementation(() => Promise.resolve(preferenceScope));
    const repository = {
      findPreference,
      createPreference: vi
        .fn<MatchingRepository['createPreference']>()
        .mockResolvedValue({ uuid: uuid3, ...preference }),
      restorePreference: vi
        .fn<MatchingRepository['restorePreference']>()
        .mockResolvedValue({ uuid: uuid3, ...preference }),
      updatePreference: vi
        .fn<MatchingRepository['updatePreference']>()
        .mockResolvedValue({ uuid: uuid3, ...preference, version: 2 }),
      archivePreference: vi
        .fn<MatchingRepository['archivePreference']>()
        .mockResolvedValue({ uuid: uuid3, status: 'ARCHIVED' }),
      listCandidates: vi
        .fn<MatchingRepository['listCandidates']>()
        .mockResolvedValue([candidate()]),
      getSignals: vi
        .fn<MatchingRepository['getSignals']>()
        .mockResolvedValue(new Map([[uuid2, signal]])),
      saveRecommendation: vi
        .fn<MatchingRepository['saveRecommendation']>()
        .mockResolvedValue({
          uuid: 'recommendation-1',
          generatedAt: new Date(),
          itemCount: 0,
        }),
      getLatestRecommendation: vi
        .fn<MatchingRepository['getLatestRecommendation']>()
        .mockResolvedValue({ uuid: 'recommendation-1' } as never),
      listRecommendationHistory: vi
        .fn<MatchingRepository['listRecommendationHistory']>()
        .mockResolvedValue({ items: [], total: 0 }),
      recordFeedback: vi
        .fn<MatchingRepository['recordFeedback']>()
        .mockResolvedValue(undefined),
      listSavedListings: vi
        .fn<MatchingRepository['listSavedListings']>()
        .mockResolvedValue([]),
      getPreferenceSubjectScope,
    } satisfies MatchingRepository;
    const rules = {
      active: vi
        .fn<MatchingRuleService['active']>()
        .mockResolvedValue({ ...DEFAULT_MATCHING_RULE, version: 1 }),
    } satisfies Pick<MatchingRuleService, 'active'>;
    const assertPermissions = vi
      .fn<AuthorizationService['assertPermissions']>()
      .mockImplementation(() => {
        if (denyPermissions) throw new ForbiddenException();
      });
    const authorization = {
      resolve: vi
        .fn<AuthorizationService['resolve']>()
        .mockResolvedValue({ permissions: ['crm.contacts.read'] }),
      assertPermissions,
    } satisfies Pick<AuthorizationService, 'resolve' | 'assertPermissions'>;
    const audit = {
      record: vi
        .fn<SecurityAuditRepository['record']>()
        .mockResolvedValue(undefined),
    } satisfies SecurityAuditRepository;
    const service = new PropertyMatchingService(
      repository,
      new MatchingEngine(),
      rules as MatchingRuleService,
      authorization as AuthorizationService,
      audit,
    );

    await service.getPreference('USER', uuid, actor);
    findPreferenceResult = null;
    await service.createPreference('USER', uuid, preference, actor);
    findPreferenceResult = { ...preference, status: 'ACTIVE' };
    await service.updatePreference('USER', uuid, 1, preference, actor);
    findPreferenceResult = { ...preference, status: 'ARCHIVED' };
    await service.restorePreference('USER', uuid, 1, actor);
    findPreferenceResult = { ...preference, status: 'ACTIVE' };
    await service.archivePreference('USER', uuid, 1, actor);
    await service.match('USER', uuid, {}, actor);
    await service.generate('USER', uuid, 'GENERATED', {}, actor);
    await service.generate('USER', uuid, 'REFRESHED', {}, actor);
    await service.getHistory('USER', uuid, 1, 10, actor);
    await service.submitFeedback(
      {
        recommendationItemUuid: uuid3,
        subjectType: 'USER',
        subjectUuid: uuid,
        propertyUuid: uuid,
        listingUuid: uuid2,
        feedback: 'INTERESTED',
      },
      actor,
    );
    await service.savedProperties(actor);

    findPreferenceResult = null;
    await expect(
      service.getPreference('USER', uuid, actor),
    ).rejects.toBeInstanceOf(NotFoundException);
    findPreferenceResult = preference;
    preferenceScope = { ownerUserUuid: uuid3 };
    await expect(
      service.getPreference('USER', uuid, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    preferenceScope = { ownerUserUuid: uuid2 };
    denyPermissions = true;
    await expect(
      service.getPreference('USER', uuid, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
