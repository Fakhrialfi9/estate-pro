import { describe, expect, it } from 'vitest';
import { buildPropertyStructuredData } from '../../../src/modules/seo/domain/property-structured-data.js';

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
        location: {
          address: 'Public Address',
          city: 'Jakarta',
          province: 'DKI Jakarta',
          country: 'Indonesia',
        },
        images: [
          {
            url: 'https://cdn.example/villa.jpg',
            thumbnailUrl: null,
            type: 'IMAGE',
            isCover: true,
            sortOrder: 1,
          },
        ],
        amenities: [
          { code: 'POOL', name: 'Swimming Pool', category: 'RECREATION' },
        ],
      },
      'https://example.test/properties/villa-sunset',
    );

    expect(data['@type']).toBe('RealEstateListing');
    expect(data.url).toBe('https://example.test/properties/villa-sunset');
    expect(data.identifier).toBe('11111111-1111-4111-8111-111111111111');
    expect(data.image).toEqual(['https://cdn.example/villa.jpg']);
    expect(data.offers).toMatchObject({
      price: '1500000000',
      priceCurrency: 'IDR',
    });
    expect(data.additionalProperty).toEqual([
      { '@type': 'PropertyValue', name: 'Swimming Pool', value: 'POOL' },
    ]);
  });

  it('omits optional structured-data branches safely', () => {
    const data = buildPropertyStructuredData(
      {
        uuid: '22222222-2222-4222-8222-222222222222',
        slug: 'draft',
        title: 'Draft',
        description: null,
        status: 'DRAFT',
        availabilityStatus: 'SOLD',
        publishedAt: null,
        updatedAt: new Date('2026-09-02T00:00:00.000Z'),
        canonicalUrl: null,
        robots: 'NOINDEX_NOFOLLOW',
        price: null,
        currency: null,
        location: null,
        images: [
          {
            url: null,
            thumbnailUrl: null,
            type: 'FLOOR_PLAN',
            isCover: false,
            sortOrder: 1,
          },
          {
            url: 'https://cdn.example/video.mp4',
            thumbnailUrl: null,
            type: 'VIDEO',
            isCover: false,
            sortOrder: 2,
          },
        ],
        amenities: [],
      },
      'https://example.test/properties/draft',
    );

    expect(data.description).toBe('Draft');
    expect(data).not.toHaveProperty('datePosted');
    expect(data).not.toHaveProperty('image');
    expect(data).not.toHaveProperty('address');
    expect(data).not.toHaveProperty('offers');
    expect(data).not.toHaveProperty('seller');
    expect(data).not.toHaveProperty('additionalProperty');
  });

  it('projects agent, unavailable offer and selected image types', () => {
    const images = Array.from({ length: 25 }, (_, index) => ({
      url: `https://cdn.example/${index}.jpg`,
      thumbnailUrl: null,
      type: index === 1 ? 'FLOOR_PLAN' : 'IMAGE',
      isCover: index === 0,
      sortOrder: index,
    }));
    const data = buildPropertyStructuredData(
      {
        uuid: '33333333-3333-4333-8333-333333333333',
        slug: 'sold',
        title: 'Sold',
        description: 'Sold property',
        status: 'ACTIVE',
        availabilityStatus: 'SOLD',
        publishedAt: new Date('2026-09-01T00:00:00.000Z'),
        updatedAt: new Date('2026-09-02T00:00:00.000Z'),
        canonicalUrl: null,
        robots: 'INDEX_FOLLOW',
        price: '100',
        currency: 'IDR',
        location: null,
        images,
        amenities: [],
        agent: { name: 'Jane Agent' },
      },
      'https://example.test/properties/sold',
    );
    expect(data.image).toHaveLength(20);
    expect(data.offers?.availability).toBe('https://schema.org/OutOfStock');
    expect(data.seller).toEqual({
      '@type': 'RealEstateAgent',
      name: 'Jane Agent',
    });
  });
});
