import { describe, expect, it } from 'vitest';

import { MatchingEngine } from '../../../src/modules/property-matching/domain/matching-engine.js';
import type {
  BehavioralSignal,
  MatchCandidate,
  PropertyPreferenceState,
} from '../../../src/modules/property-matching/domain/matching.types.js';

const candidate = (
  overrides: Partial<MatchCandidate> = {},
): MatchCandidate => ({
  propertyUuid: 'property-1',
  listingUuid: 'listing-1',
  propertyTypeUuid: 'type-1',
  propertyCategoryUuid: 'category-1',
  transactionType: 'SALE',
  listingStatus: 'PUBLISHED',
  visibility: 'PUBLIC',
  publishedAt: new Date('2026-01-01'),
  expiresAt: null,
  price: {
    currency: 'IDR',
    priceType: 'TOTAL',
    minPrice: '100000',
    maxPrice: '120000',
  },
  location: {
    countryUuid: 'id',
    provinceUuid: 'p1',
    cityUuid: 'c1',
    districtUuid: 'd1',
    subdistrictUuid: 's1',
  },
  specification: {
    bedrooms: 3,
    bathrooms: '2',
    buildingAreaSqm: '90',
    parkingSpaces: 2,
    furnishedStatus: 'FULLY_FURNISHED',
    condition: 'GOOD',
  },
  ...overrides,
});

const preference = (
  overrides: Partial<PropertyPreferenceState> = {},
): PropertyPreferenceState => ({
  version: 1,
  transactionTypes: ['SALE'],
  propertyTypeUuids: ['type-1'],
  propertyCategoryUuids: ['category-1'],
  hardCriteria: [],
  ...overrides,
});

const signal = (
  overrides: Partial<BehavioralSignal> = {},
): BehavioralSignal => ({
  saved: false,
  viewedAt: null,
  inquiryCount: 0,
  viewCount: 0,
  ...overrides,
});

describe('MatchingEngine boundaries', () => {
  it('accepts matching candidates and applies the safe-score threshold', () => {
    const engine = new MatchingEngine();
    const results = engine.evaluate(
      preference(),
      [candidate()],
      new Map([['listing-1', signal({ saved: true, inquiryCount: 1 })]]),
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      propertyUuid: 'property-1',
      listingUuid: 'listing-1',
    });
    expect(results[0]?.score).toBeGreaterThanOrEqual(35);
  });

  it('rejects hard criteria mismatches across transaction, type, category, location and budget', () => {
    const engine = new MatchingEngine();
    const base = preference({
      hardCriteria: [
        'transactionType',
        'propertyType',
        'propertyCategory',
        'location',
        'budget',
      ],
      location: {
        countryUuid: 'id',
        provinceUuid: 'p1',
        cityUuid: 'c1',
      },
      budget: {
        min: '200000',
        max: '300000',
        currency: 'IDR',
        frequency: 'TOTAL',
      },
    });

    expect(engine.evaluate(base, [candidate()], new Map())).toEqual([]);
    expect(
      engine.evaluate(
        base,
        [
          candidate({
            transactionType: 'RENT',
          }),
        ],
        new Map(),
      ),
    ).toEqual([]);
    expect(
      engine.evaluate(
        base,
        [
          candidate({
            propertyTypeUuid: 'other',
          }),
        ],
        new Map(),
      ),
    ).toEqual([]);
    expect(
      engine.evaluate(
        base,
        [
          candidate({
            location: {
              countryUuid: 'id',
              provinceUuid: 'different',
            },
          }),
        ],
        new Map(),
      ),
    ).toEqual([]);
  });

  it('handles radius distance, tolerances, partial specifications and behavioral signals', () => {
    const engine = new MatchingEngine();
    const pref = preference({
      location: {
        latitude: -6.2,
        longitude: 106.8,
        radiusKm: 10,
      },
      budget: {
        min: '100000',
        max: '100000',
        currency: 'IDR',
        frequency: 'TOTAL',
        tolerancePercent: 5,
      },
      specification: {
        bedrooms: { min: 2, max: 4 },
        bathrooms: { min: '1', max: '3' },
        areaSqm: { min: '80', max: '100' },
        parkingSpaces: { min: 1, max: 3 },
        furnishedStatus: 'FULLY_FURNISHED',
        condition: 'GOOD',
      },
    });
    const nearby = candidate({
      location: {
        latitude: -6.2,
        longitude: 106.8,
        radiusKm: 0,
      },
    });
    const results = engine.evaluate(
      pref,
      [nearby],
      new Map([
        [
          'listing-1',
          signal({ saved: true, viewedAt: new Date(), inquiryCount: 2 }),
        ],
      ]),
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.explanation.matched).toContain('behavior');
  });

  it('falls back to safe defaults when optional data is absent and sorts deterministic ties', () => {
    const engine = new MatchingEngine();
    const pref = preference();
    const first = candidate({
      listingUuid: 'listing-a',
      publishedAt: new Date('2026-01-02'),
      price: null,
      location: null,
      specification: null,
    });
    const second = candidate({
      listingUuid: 'listing-b',
      publishedAt: new Date('2026-01-02'),
      price: null,
      location: null,
      specification: null,
    });
    const results = engine.evaluate(pref, [second, first], new Map());
    expect(results.map((item) => item.listingUuid)).toEqual([
      'listing-a',
      'listing-b',
    ]);
  });

  it('drops candidates whose weighted score remains below the minimum safe score', () => {
    const engine = new MatchingEngine();
    const pref = preference({
      hardCriteria: [],
      transactionTypes: [],
      propertyTypeUuids: [],
      propertyCategoryUuids: [],
    });
    const results = engine.evaluate(pref, [candidate()], new Map());
    expect(results).toEqual([]);
  });
});
