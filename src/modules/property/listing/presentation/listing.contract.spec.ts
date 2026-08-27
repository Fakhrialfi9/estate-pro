import { describe, expect, it } from 'vitest';
import { mapPropertyDetail, mapPropertyList } from './listing.mapper.js';

describe('property read-model contract', () => {
  it('keeps the public detail contract stable and excludes sensitive fields', () => {
    const result = mapPropertyDetail({
      uuid: 'property-uuid', businessCode: 'PROP-001', referenceNumber: 'REF-001', title: 'Villa', slug: 'villa', shortDescription: 'Short', description: 'Long',
      status: 'ACTIVE', availabilityStatus: 'AVAILABLE', availableFrom: null, availableTo: null, version: 3, createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      propertyType: { uuid: 'type', code: 'HOUSE', name: 'House', slug: 'house' }, propertyCategory: { uuid: 'cat', code: 'RES', name: 'Residential', slug: 'res' }, propertySubcategory: null,
      specification: null, location: null, building: null, rooms: [], facilities: [], utilities: null, legal: { uuid: 'legal', ownershipType: 'FREEHOLD', ownershipStatus: 'VERIFIED', verificationStatus: 'VERIFIED', deedNumber: 'SECRET' }, financial: { uuid: 'fin', askingPrice: 'SECRET', negotiable: true },
      media: [], agentAssignments: [], owner: { uuid: 'owner', ownerType: 'INDIVIDUAL', displayNameMasked: 'Mu****in', companyNameMasked: 'PRIVATE CO' }, features: null, security: null, environment: null, seo: null, audit: [{ action: 'property.updated', result: 'SUCCESS', reason: null, createdAt: new Date('2026-01-02T00:00:00.000Z') }],
      listing: { uuid: 'listing', listingCode: 'LST-001', transactionType: 'SALE', status: 'PUBLISHED', visibility: 'PUBLIC', featured: true, premium: false, verifiedAt: new Date('2026-01-02T00:00:00.000Z'), publishedAt: new Date('2026-01-02T00:00:00.000Z'), expiresAt: null, version: 1, price: { uuid: 'price', priceType: 'TOTAL', currency: 'IDR', minPrice: '1000000.00', maxPrice: null, pricePerSqm: null }, paymentOptions: [], analytics: { viewCount: 10n, inquiryCount: 1n, shareCount: 1n, saveCount: 2n, updatedAt: new Date('2026-01-02T00:00:00.000Z') }, engagements: [] }, related: [],
    }, { canReadSensitive: false, canReadAnalytics: false });

    expect(result).toMatchObject({
      uuid: 'property-uuid',
      status: { code: 'ACTIVE' },
      availability: { status: 'AVAILABLE', from: null, to: null },
      listing: { uuid: 'listing', code: 'LST-001', transactionType: 'SALE', status: 'PUBLISHED', visibility: 'PUBLIC', price: { currency: 'IDR', min: '1000000.00' } },
      owner: { uuid: 'owner', ownerType: 'INDIVIDUAL', displayName: 'Mu****in' },
      legal: { uuid: 'legal', ownershipType: 'FREEHOLD', ownershipStatus: 'VERIFIED', verificationStatus: 'VERIFIED' },
      financial: { uuid: 'fin', negotiable: true },
      analytics: null,
      audit: [],
      metadata: { version: 3 },
    });
    expect(result.owner).not.toHaveProperty('companyName');
    expect(result.legal).not.toHaveProperty('deedNumber');
    expect(result.financial).not.toHaveProperty('askingPrice');
  });

  it('keeps list contract stable and numeric counters serialized', () => {
    const result = mapPropertyList([{ uuid: 'p', businessCode: 'P-1', referenceNumber: 'R-1', title: 'Villa', slug: 'villa', status: 'ACTIVE', availabilityStatus: 'AVAILABLE', propertyType: { uuid: 't', name: 'House' }, propertyCategory: { uuid: 'c', name: 'Residential' }, createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-02T00:00:00.000Z'), listing: { uuid: 'l', listingCode: 'L-1', transactionType: 'SALE', status: 'PUBLISHED', visibility: 'PUBLIC', featured: false, premium: false, verifiedAt: new Date(), publishedAt: null, expiresAt: null, price: { currency: 'IDR', minPrice: '1.00', maxPrice: null, pricePerSqm: '0.01' }, analytics: { viewCount: 9n } } }]);
    expect(result[0]).toMatchObject({ uuid: 'p', listing: { uuid: 'l', verified: true, views: '9', price: { perSqm: '0.01' } } });
  });
});
