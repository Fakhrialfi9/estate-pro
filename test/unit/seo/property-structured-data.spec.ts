import { describe, expect, it } from 'vitest';
import { buildPropertyStructuredData } from '../../src/modules/seo/domain/property-structured-data.js';

describe('PropertyStructuredData', () => {
  it('emits public property, offer, image, location and amenity projections only', () => {
    const data = buildPropertyStructuredData(
      {
        uuid: '11111111-1111-4111-8111-111111111111',
        slug: 'villa-sunset',
        title: 'Villa Sunset',
        description: 'Public description',
        status: 'ACTIVE',
        availabilityStatus: 'AVAILABLE',
        publishedAt: new Date('2026-09-01T00:00:00.000Z'),
        updatedAt: new Date('2026-09-02T00:00:00.000Z'),
        canonicalUrl: null,
        robots: 'INDEX_FOLLOW',
        price: '1500000000',
        currency: 'IDR',
        location: { address: 'Public Address', city: 'Jakarta', province: 'DKI Jakarta', country: 'Indonesia' },
        images: [
          { url: 'https://cdn.example/villa.jpg', thumbnailUrl: null, type: 'IMAGE', isCover: true, sortOrder: 1 },
        ],
        amenities: [{ code: 'POOL', name: 'Swimming Pool', category: 'RECREATION' }],
      },
      'https://example.test/properties/villa-sunset',
    );

    expect(data['@type']).toBe('RealEstateListing');
    expect(data.url).toBe('https://example.test/properties/villa-sunset');
    expect(data.identifier).toBe('11111111-1111-4111-8111-111111111111');
    expect(data.image).toEqual(['https://cdn.example/villa.jpg']);
    expect(data.offers).toMatchObject({ price: '1500000000', priceCurrency: 'IDR' });
    expect(data.additionalProperty).toEqual([
      { '@type': 'PropertyValue', name: 'Swimming Pool', value: 'POOL' },
    ]);
  });
});
