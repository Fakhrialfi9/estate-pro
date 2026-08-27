type ReadRecord = { readonly [key: string]: unknown };
const record = (value: unknown): ReadRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as ReadRecord)
    : {};
const records = (value: unknown): readonly ReadRecord[] =>
  Array.isArray(value) ? value.map(record) : [];
const dateValue = (value: unknown): string | null =>
  value instanceof Date
    ? value.toISOString()
    : typeof value === 'string'
      ? value
      : null;
type DecimalLike = {
  readonly toFixed: (fractionDigits?: number) => string;
};
const isDecimalLike = (value: object): value is DecimalLike =>
  'toFixed' in value && typeof value.toFixed === 'function';
const decimalValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint'
  )
    return String(value);

  if (typeof value === 'object' && isDecimalLike(value))
    return value.toFixed();

  return null;
};
export interface PropertyDetailViewer {
  readonly canReadSensitive: boolean;
  readonly canReadAnalytics: boolean;
}
export function mapListingResponse(input: unknown): ReadRecord {
  const raw = record(input);
  const price = record(raw.price);
  const property = record(raw.property);
  return {
    uuid: raw.uuid,
    listingCode: raw.listingCode,
    transactionType: raw.transactionType,
    status: raw.status,
    visibility: raw.visibility,
    featured: raw.featured,
    premium: raw.premium,
    verifiedAt: dateValue(raw.verifiedAt),
    publishedAt: dateValue(raw.publishedAt),
    expiresAt: dateValue(raw.expiresAt),
    rejectionReason: raw.rejectionReason,
    version: raw.version,
    property: property.uuid ? { uuid: property.uuid } : null,
    price: price.uuid
      ? {
          uuid: price.uuid,
          priceType: price.priceType,
          currency: price.currency,
          min: decimalValue(price.minPrice),
          max: decimalValue(price.maxPrice),
          perSqm: decimalValue(price.pricePerSqm),
        }
      : null,
    paymentOptions: records(raw.paymentOptions).map((item) => ({
      uuid: item.uuid,
      type: item.optionType,
      downPaymentAmount: decimalValue(item.downPaymentAmount),
      downPaymentPercent: decimalValue(item.downPaymentPercent),
      installmentAmount: decimalValue(item.installmentAmount),
      tenorMonths: item.tenorMonths,
    })),
  };
}
export function mapAgentAssignment(input: unknown): ReadRecord {
  const raw = record(input);
  return {
    uuid: raw.uuid,
    displayName: raw.agentDisplayName,
    isPrimary: raw.isPrimary,
    assignedAt: dateValue(raw.assignedAt),
  };
}
export function mapOwnerResponse(input: unknown): ReadRecord {
  const raw = record(input);
  return {
    uuid: raw.uuid,
    ownerType: raw.ownerType,
    displayName: raw.displayNameMasked,
    companyName: raw.companyNameMasked ?? null,
  };
}
export function mapPropertyDetail(
  input: unknown,
  viewer: PropertyDetailViewer,
): ReadRecord {
  const raw = record(input);
  const location = record(raw.location);
  const listing = record(raw.listing);
  const price = record(listing.price);
  const owner = record(raw.owner);
  const analytics = record(listing.analytics);
  const engagement = records(listing.engagements)[0];
  return {
    uuid: raw.uuid,
    code: raw.businessCode,
    referenceNumber: raw.referenceNumber,
    title: raw.title,
    slug: raw.slug,
    shortDescription: raw.shortDescription,
    description: raw.description,
    status: { code: raw.status },
    availability: {
      status: raw.availabilityStatus,
      from: dateValue(raw.availableFrom),
      to: dateValue(raw.availableTo),
    },
    type: raw.propertyType,
    category: raw.propertyCategory,
    subcategory: raw.propertySubcategory,
    listing: listing.uuid
      ? {
          uuid: listing.uuid,
          code: listing.listingCode,
          transactionType: listing.transactionType,
          status: listing.status,
          visibility: listing.visibility,
          featured: listing.featured,
          premium: listing.premium,
          verifiedAt: dateValue(listing.verifiedAt),
          publishedAt: dateValue(listing.publishedAt),
          expiresAt: dateValue(listing.expiresAt),
          version: listing.version,
          price: price.uuid
            ? {
                uuid: price.uuid,
                priceType: price.priceType,
                currency: price.currency,
                min: decimalValue(price.minPrice),
                max: decimalValue(price.maxPrice),
                perSqm: decimalValue(price.pricePerSqm),
              }
            : null,
          paymentOptions: records(listing.paymentOptions).map((item) => ({
            uuid: item.uuid,
            type: item.optionType,
            downPaymentAmount: decimalValue(item.downPaymentAmount),
            downPaymentPercent: decimalValue(item.downPaymentPercent),
            installmentAmount: decimalValue(item.installmentAmount),
            tenorMonths: item.tenorMonths,
            notes: item.notes,
          })),
        }
      : null,
    specification: raw.specification,
    location: location.uuid
      ? {
          uuid: location.uuid,
          addressLine: location.addressLine,
          street: location.street,
          building: location.building,
          block: location.block,
          unit: location.unit,
          neighborhood: location.neighborhood,
          postalCode: location.postalCode,
          latitude: decimalValue(location.latitude),
          longitude: decimalValue(location.longitude),
          coordinateAccuracy: location.coordinateAccuracy,
          mapProvider: location.mapProvider,
          placeId: location.placeId,
          mapUrl: location.mapUrl,
          risk: {
            flood: location.floodRisk,
            earthquake: location.earthquakeRisk,
            traffic: location.trafficRisk,
            noise: location.noiseRisk,
            airQuality: location.airQualityRisk,
          },
          country: location.country,
          province: location.province,
          city: location.city,
          district: location.district,
          subdistrict: location.subdistrict,
        }
      : null,
    building: raw.building,
    rooms: records(raw.rooms).map((room) => ({
      ...room,
      area: decimalValue(room.area),
    })),
    facilities: records(raw.facilities),
    utilities: raw.utilities,
    legal: viewer.canReadSensitive
      ? raw.legal
      : (() => {
          const safe = record(raw.legal);
          return safe.uuid
            ? {
                uuid: safe.uuid,
                ownershipType: safe.ownershipType,
                ownershipStatus: safe.ownershipStatus,
                verificationStatus: safe.verificationStatus,
              }
            : null;
        })(),
    financial: viewer.canReadSensitive
      ? raw.financial
      : (() => {
          const safe = record(raw.financial);
          return safe.uuid
            ? { uuid: safe.uuid, negotiable: safe.negotiable }
            : null;
        })(),
    media: records(raw.media),
    agent: records(raw.agentAssignments).map((item) => ({
      uuid: item.uuid,
      displayName: item.agentDisplayName,
      isPrimary: item.isPrimary,
    })),
    owner: owner.uuid
      ? {
          uuid: owner.uuid,
          ownerType: owner.ownerType,
          displayName: owner.displayNameMasked,
          ...(viewer.canReadSensitive
            ? { companyName: owner.companyNameMasked }
            : {}),
        }
      : null,
    features: raw.features,
    security: raw.security,
    environment: raw.environment,
    seo: raw.seo,
    analytics:
      viewer.canReadAnalytics && analytics.viewCount !== undefined
        ? {
            viewCount: decimalValue(analytics.viewCount),
            inquiryCount: decimalValue(analytics.inquiryCount),
            shareCount: decimalValue(analytics.shareCount),
            saveCount: decimalValue(analytics.saveCount),
            updatedAt: dateValue(analytics.updatedAt),
          }
        : null,
    engagement: engagement
      ? {
          isSaved: engagement.isSaved,
          viewedAt: dateValue(engagement.viewedAt),
        }
      : null,
    related: records(raw.related).map((item) => {
      const itemListing = record(item.listing);
      const itemPrice = record(itemListing.price);
      return {
        uuid: item.uuid,
        title: item.title,
        slug: item.slug,
        status: item.status,
        availabilityStatus: item.availabilityStatus,
        type: item.propertyType,
        category: item.propertyCategory,
        listing: itemListing.uuid
          ? {
              code: itemListing.listingCode,
              transactionType: itemListing.transactionType,
              status: itemListing.status,
              price: itemPrice.currency
                ? {
                    currency: itemPrice.currency,
                    min: decimalValue(itemPrice.minPrice),
                    max: decimalValue(itemPrice.maxPrice),
                  }
                : null,
            }
          : null,
      };
    }),
    audit: viewer.canReadSensitive
      ? records(raw.audit).map((event) => ({
          action: event.action,
          result: event.result,
          reason: event.reason,
          timestamp: dateValue(event.createdAt),
        }))
      : [],
    metadata: {
      version: raw.version,
      createdAt: dateValue(raw.createdAt),
      updatedAt: dateValue(raw.updatedAt),
    },
  };
}
export function mapPropertyList(
  items: readonly unknown[],
): readonly ReadRecord[] {
  return items.map((value) => {
    const property = record(value);
    const listing = record(property.listing);
    const price = record(listing.price);
    const analytics = record(listing.analytics);
    return {
      uuid: property.uuid,
      code: property.businessCode,
      referenceNumber: property.referenceNumber,
      title: property.title,
      slug: property.slug,
      status: property.status,
      availabilityStatus: property.availabilityStatus,
      type: property.propertyType,
      category: property.propertyCategory,
      listing: listing.uuid
        ? {
            uuid: listing.uuid,
            code: listing.listingCode,
            transactionType: listing.transactionType,
            status: listing.status,
            visibility: listing.visibility,
            featured: listing.featured,
            premium: listing.premium,
            verified: listing.verifiedAt !== null,
            publishedAt: dateValue(listing.publishedAt),
            expiresAt: dateValue(listing.expiresAt),
            price: price.currency
              ? {
                  currency: price.currency,
                  min: decimalValue(price.minPrice),
                  max: decimalValue(price.maxPrice),
                  perSqm: decimalValue(price.pricePerSqm),
                }
              : null,
            views: decimalValue(analytics.viewCount) ?? '0',
          }
        : null,
      timestamps: {
        createdAt: dateValue(property.createdAt),
        updatedAt: dateValue(property.updatedAt),
      },
    };
  });
}
