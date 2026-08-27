import { describe, expect, it } from 'vitest';
import { assertListingTransition, assertPaymentInvariants, assertPricingInvariants, assertPublishable, derivePricePerSqm } from './listing.types.js';

describe('listing domain invariants', () => {
  it('allows the explicit lifecycle and rejects arbitrary transitions', () => {
    expect(() => assertListingTransition('DRAFT', 'IN_REVIEW')).not.toThrow();
    expect(() => assertListingTransition('DRAFT', 'PUBLISHED')).toThrow(/Invalid listing transition/);
    expect(() => assertListingTransition('PUBLISHED', 'SOLD')).not.toThrow();
  });
  it('protects money and price boundaries', () => {
    expect(() => assertPricingInvariants({ priceType: 'TOTAL', currency: 'IDR', minPrice: '1000000.00', maxPrice: '2000000.00' })).not.toThrow();
    expect(() => assertPricingInvariants({ priceType: 'TOTAL', currency: 'IDR', minPrice: '2000000.00', maxPrice: '1000000.00' })).toThrow(/Minimum price/);
    expect(() => assertPricingInvariants({ priceType: 'TOTAL', currency: 'US', minPrice: '1.00' })).toThrow(/currency/);
  });
  it('validates payment percentage and tenor invariants', () => {
    expect(() => assertPaymentInvariants({ optionType: 'INSTALLMENT', downPaymentPercent: '20', installmentAmount: '5000000', tenorMonths: 24 })).not.toThrow();
    expect(() => assertPaymentInvariants({ optionType: 'INSTALLMENT', installmentAmount: '5000000' })).toThrow(/Tenor/);
    expect(() => assertPaymentInvariants({ optionType: 'CASH', downPaymentPercent: '101' })).toThrow(/between 0 and 100/);
  });
  it('derives deterministic price per sqm without floating-point persistence', () => {
    expect(derivePricePerSqm('1000000000.00', '100.00')).toBe('10000000.0000');
  });
  it('requires explicit publish prerequisites', () => {
    expect(() => assertPublishable({ propertyStatus: 'ACTIVE', visibility: 'PUBLIC', hasPrice: true, hasPrimaryAgent: true, expiresAt: new Date(Date.now() + 60000) })).not.toThrow();
    expect(() => assertPublishable({ propertyStatus: 'DRAFT', visibility: 'PUBLIC', hasPrice: true, hasPrimaryAgent: true })).toThrow(/ACTIVE/);
  });
});
