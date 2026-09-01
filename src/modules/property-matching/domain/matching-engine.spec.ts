import { describe, expect, it } from 'vitest';
import { MatchingEngine } from './matching-engine.js';
import { PropertyPreference } from './property-preference.js';
import type { MatchCandidate } from './matching.types.js';

const candidate = (
  overrides: Partial<MatchCandidate> = {},
): MatchCandidate => ({
  propertyUuid: '11111111-1111-4111-8111-111111111111',
  listingUuid: '22222222-2222-4222-8222-222222222222',
  propertyTypeUuid: '33333333-3333-4333-8333-333333333333',
  propertyCategoryUuid: '44444444-4444-4444-8444-444444444444',
  transactionType: 'SALE',
  listingStatus: 'PUBLISHED',
  visibility: 'PUBLIC',
  publishedAt: new Date('2026-09-01T00:00:00Z'),
  expiresAt: null,
  price: {
    currency: 'IDR',
    priceType: 'TOTAL',
    minPrice: '1000000000',
    maxPrice: '1000000000',
  },
  location: { countryUuid: '55555555-5555-4555-8555-555555555555' },
  specification: {
    bedrooms: 3,
    bathrooms: '2',
    buildingAreaSqm: '120',
    parkingSpaces: 2,
    furnishedStatus: 'FULLY_FURNISHED',
    condition: 'GOOD',
  },
  ...overrides,
});

describe('PropertyPreference', () => {
  it('rejects invalid ranges and missing hard-constraint values', () => {
    expect(() =>
      PropertyPreference.create({
        transactionTypes: ['SALE'],
        propertyTypeUuids: [],
        propertyCategoryUuids: [],
        hardCriteria: ['propertyType'],
      }),
    ).toThrow('propertyType hard criterion requires a property type');
    expect(() =>
      PropertyPreference.create({
        transactionTypes: ['SALE'],
        propertyTypeUuids: [],
        propertyCategoryUuids: [],
        hardCriteria: [],
        budget: { min: '200', max: '100', currency: 'IDR', frequency: 'TOTAL' },
      }),
    ).toThrow('budget.min must not exceed budget.max');
  });

  it('rejects invalid coordinate radius combinations', () => {
    expect(() => PropertyPreference.assertLocation({ radiusKm: 10 })).toThrow(
      'latitude and longitude must be supplied together',
    );
  });
});

describe('MatchingEngine', () => {
  const engine = new MatchingEngine();
  const preference = PropertyPreference.create({
    transactionTypes: ['SALE'],
    propertyTypeUuids: ['33333333-3333-4333-8333-333333333333'],
    propertyCategoryUuids: [],
    hardCriteria: ['transactionType', 'propertyType'],
    budget: {
      min: '900000000',
      max: '1100000000',
      currency: 'IDR',
      frequency: 'TOTAL',
    },
  }).value;

  it('filters hard constraints before scoring', () => {
    const results = engine.evaluate(
      preference,
      [
        candidate(),
        candidate({
          listingUuid: '66666666-6666-4666-8666-666666666666',
          transactionType: 'RENT',
        }),
      ],
      new Map(),
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.listingUuid).toBe(
      '22222222-2222-4222-8222-222222222222',
    );
  });

  it('produces stable deterministic ranking and safe explanations', () => {
    const first = engine.evaluate(
      preference,
      [
        candidate(),
        candidate({ listingUuid: '77777777-7777-4777-8777-777777777777' }),
      ],
      new Map(),
    );
    const second = engine.evaluate(
      preference,
      [
        candidate({ listingUuid: '77777777-7777-4777-8777-777777777777' }),
        candidate(),
      ],
      new Map(),
    );
    expect(first.map((item) => [item.listingUuid, item.score])).toEqual(
      second.map((item) => [item.listingUuid, item.score]),
    );
    expect(first[0]?.explanation).toEqual(
      expect.objectContaining({
        matched: expect.any(Array),
        missed: expect.any(Array),
        contributions: expect.any(Array),
      }),
    );
  });
});
