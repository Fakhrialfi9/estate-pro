import { describe, expect, it } from 'vitest';
import {
  assertListingTransition,
  assertPaymentInvariants,
  assertPricingInvariants,
  assertPublishable,
  derivePricePerSqm,
  LISTING_STATUSES,
  LISTING_TRANSITIONS,
} from './listing.types.js';

describe('listing workflow matrix', () => {
  it.each(LISTING_STATUSES)(
    'has an explicit transition policy for %s',
    (status) => {
      expect(Array.isArray(LISTING_TRANSITIONS[status])).toBe(true);
    },
  );

  it('covers every business workflow transition explicitly', () => {
    const expected: readonly [
      (typeof LISTING_STATUSES)[number],
      (typeof LISTING_STATUSES)[number],
    ][] = [
      ['DRAFT', 'IN_REVIEW'],
      ['IN_REVIEW', 'DRAFT'],
      ['IN_REVIEW', 'VERIFIED'],
      ['VERIFIED', 'ACTIVE'],
      ['ACTIVE', 'PUBLISHED'],
      ['PUBLISHED', 'UNPUBLISHED'],
      ['PUBLISHED', 'SOLD'],
      ['PUBLISHED', 'RENTED'],
      ['PUBLISHED', 'EXPIRED'],
      ['ACTIVE', 'ARCHIVED'],
      ['UNPUBLISHED', 'ARCHIVED'],
      ['ARCHIVED', 'ACTIVE'],
    ];
    for (const [from, to] of expected)
      expect(() => assertListingTransition(from, to)).not.toThrow();
    expect(() => assertListingTransition('DRAFT', 'PUBLISHED')).toThrow();
    expect(() => assertListingTransition('SOLD', 'PUBLISHED')).toThrow();
  });

  it('rejects invalid price and payment combinations', () => {
    expect(() =>
      assertPricingInvariants({
        priceType: 'TOTAL',
        currency: 'IDR',
        minPrice: '500000000.00',
        maxPrice: '499999999.99',
      }),
    ).toThrow();
    expect(() =>
      assertPricingInvariants({
        priceType: 'TOTAL',
        currency: 'IDR',
        minPrice: '0.00',
      }),
    ).toThrow();
    expect(() =>
      assertPaymentInvariants({
        optionType: 'INSTALLMENT',
        installmentAmount: '1.00',
      }),
    ).toThrow();
    expect(() =>
      assertPaymentInvariants({
        optionType: 'MORTGAGE',
        downPaymentPercent: '100.01',
      }),
    ).toThrow();
    expect(derivePricePerSqm('1200000000.00', '100.0000')).toBe(
      '12000000.0000',
    );
  });

  it('requires all publish preconditions', () => {
    const future = new Date(Date.now() + 60_000);
    expect(() =>
      assertPublishable({
        propertyStatus: 'ACTIVE',
        visibility: 'PUBLIC',
        hasPrice: true,
        hasPrimaryAgent: true,
        expiresAt: future,
      }),
    ).not.toThrow();
    expect(() =>
      assertPublishable({
        propertyStatus: 'ACTIVE',
        visibility: 'PRIVATE',
        hasPrice: true,
        hasPrimaryAgent: true,
        expiresAt: future,
      }),
    ).toThrow();
    expect(() =>
      assertPublishable({
        propertyStatus: 'ACTIVE',
        visibility: 'PUBLIC',
        hasPrice: false,
        hasPrimaryAgent: true,
        expiresAt: future,
      }),
    ).toThrow();
    expect(() =>
      assertPublishable({
        propertyStatus: 'ACTIVE',
        visibility: 'PUBLIC',
        hasPrice: true,
        hasPrimaryAgent: false,
        expiresAt: future,
      }),
    ).toThrow();
  });
});
