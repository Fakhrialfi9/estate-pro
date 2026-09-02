import { describe, expect, it } from 'vitest';
import { MatchingEngine } from './matching-engine.js';
import { PropertyPreference } from './property-preference.js';
import type {
  BehavioralSignal,
  MatchCandidate,
  PropertyPreferenceState,
} from './matching.types.js';

const baseLocation = {
  countryUuid: '11111111-1111-4111-8111-111111111111',
  provinceUuid: '22222222-2222-4222-8222-222222222222',
  cityUuid: '33333333-3333-4333-8333-333333333333',
};

const basePreference = (): Omit<PropertyPreferenceState, 'version'> => ({
  transactionTypes: ['SALE'],
  propertyTypeUuids: [],
  propertyCategoryUuids: [],
  location: baseLocation,
  hardCriteria: [],
});

describe('PropertyPreference', () => {
  it('rejects invalid ranges and missing hard-constraint values', () => {
    expect(() =>
      PropertyPreference.create({
        ...basePreference(),
        hardCriteria: ['transactionType'],
        transactionTypes: [],
      }),
    ).toThrow('transactionType hard criterion requires a transaction type');
    expect(() =>
      PropertyPreference.create({
        ...basePreference(),
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
      'radiusKm requires latitude and longitude',
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
        {
          propertyUuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          listingUuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          propertyTypeUuid: '33333333-3333-4333-8333-333333333333',
          propertyCategoryUuid: '44444444-4444-4444-8444-444444444444',
          transactionType: 'SALE',
          listingStatus: 'PUBLISHED',
          visibility: 'PUBLIC',
          publishedAt: new Date('2026-01-01T00:00:00Z'),
          expiresAt: null,
          price: {
            currency: 'IDR',
            priceType: 'TOTAL',
            minPrice: '1000000000',
            maxPrice: '1000000000',
          },
          location: null,
          specification: null,
        },
        {
          propertyUuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          listingUuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          propertyTypeUuid: '55555555-5555-4555-8555-555555555555',
          propertyCategoryUuid: '44444444-4444-4444-8444-444444444444',
          transactionType: 'SALE',
          listingStatus: 'PUBLISHED',
          visibility: 'PUBLIC',
          publishedAt: new Date('2026-01-02T00:00:00Z'),
          expiresAt: null,
          price: {
            currency: 'IDR',
            priceType: 'TOTAL',
            minPrice: '1000000000',
            maxPrice: '1000000000',
          },
          location: null,
          specification: null,
        },
      ],
      new Map<string, BehavioralSignal>(),
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.propertyUuid).toBe(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
  });

  it('produces stable deterministic ranking and safe explanations', () => {
    const candidate = (id: string, publishedAt: string): MatchCandidate => ({
      propertyUuid: id,
      listingUuid: `${id.slice(0, 8)}-1111-4111-8111-111111111111`,
      propertyTypeUuid: '33333333-3333-4333-8333-333333333333',
      propertyCategoryUuid: '44444444-4444-4444-8444-444444444444',
      transactionType: 'SALE',
      listingStatus: 'PUBLISHED',
      visibility: 'PUBLIC',
      publishedAt: new Date(publishedAt),
      expiresAt: null,
      price: {
        currency: 'IDR',
        priceType: 'TOTAL',
        minPrice: '1000000000',
        maxPrice: '1000000000',
      },
      location: null,
      specification: null,
    });
    const first = candidate(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '2026-01-01T00:00:00Z',
    );
    const second = candidate(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '2026-01-02T00:00:00Z',
    );
    const results = engine.evaluate(
      preference,
      [first, second],
      new Map<string, BehavioralSignal>(),
    );
    expect(results).toHaveLength(2);
    expect(results[0]?.listingUuid).toBe(second.listingUuid);
    expect(results.every((result) => !result.explanation.matched.includes('password'))).toBe(true);
  });
});
