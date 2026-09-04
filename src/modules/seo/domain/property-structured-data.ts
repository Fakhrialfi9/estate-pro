import type { PropertySeoPublicSnapshot } from '../../../common/contracts/property-seo-public.port.js';

export const buildPropertyStructuredData = (
  property: PropertySeoPublicSnapshot,
  canonicalUrl: string,
): Record<string, unknown> => {
  const images = property.images
    .filter((image) => image.type === 'IMAGE' || image.type === 'FLOOR_PLAN')
    .map((image) => image.url)
    .filter(Boolean)
    .slice(0, 20);

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.title,
    description: property.description ?? property.title,
    url: canonicalUrl,
    identifier: property.uuid,
    dateModified: property.updatedAt.toISOString(),
  };

  if (property.publishedAt)
    data.datePosted = property.publishedAt.toISOString();
  if (images.length > 0) data.image = images;

  if (property.location) {
    data.address = {
      '@type': 'PostalAddress',
      ...(property.location.address
        ? { streetAddress: property.location.address }
        : {}),
      ...(property.location.city
        ? { addressLocality: property.location.city }
        : {}),
      ...(property.location.province
        ? { addressRegion: property.location.province }
        : {}),
      ...(property.location.country
        ? { addressCountry: property.location.country }
        : {}),
    };
  }

  if (property.price && property.currency) {
    data.offers = {
      '@type': 'Offer',
      price: property.price,
      priceCurrency: property.currency,
      availability:
        property.availabilityStatus === 'AVAILABLE'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      url: canonicalUrl,
    };
  }

  if (property.agent) {
    data.seller = {
      '@type': 'RealEstateAgent',
      name: property.agent.name,
    };
  }

  if (property.amenities.length > 0) {
    data.additionalProperty = property.amenities
      .slice(0, 100)
      .map((amenity) => ({
        '@type': 'PropertyValue',
        name: amenity.name,
        value: amenity.code,
      }));
  }

  return data;
};
