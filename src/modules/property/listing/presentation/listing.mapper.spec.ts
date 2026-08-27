import { describe, expect, it } from 'vitest';
import { mapPropertyDetail, mapPropertyList } from './listing.mapper.js';

describe('listing read model mapper', () => {
  it('maps sensitive resources without exposing internal ids or raw owner data', () => {
    const output = mapPropertyDetail(
      {
        id: 1n,
        uuid: 'property-uuid',
        businessCode: 'PROP-1',
        referenceNumber: 'REF-1',
        title: 'Villa',
        slug: 'villa',
        status: 'ACTIVE',
        availabilityStatus: 'AVAILABLE',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
        owner: {
          uuid: 'owner-uuid',
          ownerType: 'INDIVIDUAL',
          displayNameMasked: 'M***h',
          companyNameMasked: 'Hidden Co',
        },
        listing: {
          uuid: 'listing-uuid',
          listingCode: 'L-1',
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          featured: false,
          premium: false,
          transactionType: 'SALE',
          version: 1,
          paymentOptions: [],
          price: {
            uuid: 'price-uuid',
            currency: 'IDR',
            minPrice: { toString: () => '1000000.00' },
            maxPrice: null,
            pricePerSqm: null,
          },
          analytics: {
            viewCount: 3n,
            inquiryCount: 1n,
            shareCount: 0n,
            saveCount: 0n,
            updatedAt: new Date(),
          },
          engagements: [],
        },
        audit: [],
      },
      { canReadSensitive: false, canReadAnalytics: false },
    );
    expect(output).not.toHaveProperty('id');
    expect(output.owner).toEqual({
      uuid: 'owner-uuid',
      ownerType: 'INDIVIDUAL',
      displayName: 'M***h',
    });
    expect(output.analytics).toBeNull();
    expect(output.listing).toMatchObject({
      uuid: 'listing-uuid',
      price: { min: '1000000.00' },
    });
  });
  it('keeps list output compact and stable', () => {
    const output = mapPropertyList([
      {
        id: 10n,
        uuid: 'p',
        businessCode: 'P',
        referenceNumber: 'R',
        title: 'A',
        slug: 'a',
        status: 'ACTIVE',
        availabilityStatus: 'AVAILABLE',
        propertyType: { uuid: 't', name: 'House' },
        propertyCategory: { uuid: 'c', name: 'Residential' },
        listing: {
          uuid: 'l',
          listingCode: 'L',
          transactionType: 'SALE',
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          featured: true,
          premium: true,
          verifiedAt: new Date(),
          price: {
            currency: 'IDR',
            minPrice: { toString: () => '1.00' },
            maxPrice: null,
            pricePerSqm: null,
          },
          analytics: { viewCount: 4n },
        },
      },
    ]);
    expect(output[0]).toMatchObject({ uuid: 'p' });
    expect(output[0]?.listing).toMatchObject({
      verified: true,
      views: '4',
    });
  });
});
