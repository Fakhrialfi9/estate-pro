import { createHash } from 'node:crypto';

import type { SeedTransaction } from '../database.ts';
import { seedUuid, SEED_REFERENCE_DATE } from '../shared/ids.ts';
import {
  AMENITIES,
  FACILITIES,
  LOCATIONS,
  PROPERTY_CATEGORIES,
  PROPERTY_FIXTURES,
  PROPERTY_SUBCATEGORIES,
  PROPERTY_TYPES,
} from './data.ts';

function checksum(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function seedLocationMaster(tx: SeedTransaction) {
  const locationIds = new Map<number, { countryId: bigint; provinceId: bigint; cityId: bigint; districtId: bigint; subdistrictId: bigint }>();

  for (let index = 0; index < LOCATIONS.length; index += 1) {
    const location = LOCATIONS[index];
    const country = await tx.country.upsert({
      where: { code: location.country.code },
      update: { name: location.country.name, slug: location.country.slug, isActive: true, deletedAt: null, sortOrder: index + 1 },
      create: { uuid: seedUuid('country', location.country.code), code: location.country.code, name: location.country.name, slug: location.country.slug, sortOrder: index + 1 },
    });
    const province = await tx.province.upsert({
      where: { countryId_code: { countryId: country.id, code: location.province.code } },
      update: { name: location.province.name, slug: location.province.slug, isActive: true, deletedAt: null, sortOrder: index + 1 },
      create: { uuid: seedUuid('province', location.province.code), countryId: country.id, code: location.province.code, name: location.province.name, slug: location.province.slug, sortOrder: index + 1 },
    });
    const city = await tx.city.upsert({
      where: { provinceId_code: { provinceId: province.id, code: location.city.code } },
      update: { name: location.city.name, slug: location.city.slug, isActive: true, deletedAt: null, sortOrder: index + 1 },
      create: { uuid: seedUuid('city', location.city.code), provinceId: province.id, code: location.city.code, name: location.city.name, slug: location.city.slug, sortOrder: index + 1 },
    });
    const district = await tx.district.upsert({
      where: { cityId_code: { cityId: city.id, code: location.district.code } },
      update: { name: location.district.name, slug: location.district.slug, isActive: true, deletedAt: null, sortOrder: index + 1 },
      create: { uuid: seedUuid('district', location.district.code), cityId: city.id, code: location.district.code, name: location.district.name, slug: location.district.slug, sortOrder: index + 1 },
    });
    const subdistrict = await tx.subdistrict.upsert({
      where: { districtId_code: { districtId: district.id, code: location.subdistrict.code } },
      update: { name: location.subdistrict.name, slug: location.subdistrict.slug, isActive: true, deletedAt: null, sortOrder: index + 1 },
      create: { uuid: seedUuid('subdistrict', location.subdistrict.code), districtId: district.id, code: location.subdistrict.code, name: location.subdistrict.name, slug: location.subdistrict.slug, sortOrder: index + 1 },
    });
    locationIds.set(index, {
      countryId: country.id,
      provinceId: province.id,
      cityId: city.id,
      districtId: district.id,
      subdistrictId: subdistrict.id,
    });
  }

  return locationIds;
}

async function seedCatalog(tx: SeedTransaction) {
  const typeIds = new Map<string, bigint>();
  for (const item of PROPERTY_TYPES) {
    const record = await tx.propertyType.upsert({
      where: { code: item.code },
      update: { name: item.name, slug: item.slug, description: item.description, sortOrder: item.sortOrder, isActive: true, deletedAt: null },
      create: { uuid: seedUuid('property-type', item.code), code: item.code, name: item.name, slug: item.slug, description: item.description, sortOrder: item.sortOrder },
    });
    typeIds.set(item.code, record.id);
  }

  const categoryIds = new Map<string, bigint>();
  for (const item of PROPERTY_CATEGORIES) {
    const propertyTypeId = typeIds.get(item.typeCode);
    if (propertyTypeId === undefined) throw new Error(`Missing property type fixture: ${item.typeCode}`);
    const record = await tx.propertyCategory.upsert({
      where: { propertyTypeId_code: { propertyTypeId, code: item.code } },
      update: { name: item.name, slug: item.slug, sortOrder: item.sortOrder, isActive: true, deletedAt: null },
      create: { uuid: seedUuid('property-category', item.code), propertyTypeId, code: item.code, name: item.name, slug: item.slug, sortOrder: item.sortOrder },
    });
    categoryIds.set(item.code, record.id);
  }

  const subcategoryIds = new Map<string, bigint>();
  for (const item of PROPERTY_SUBCATEGORIES) {
    const propertyCategoryId = categoryIds.get(item.categoryCode);
    if (propertyCategoryId === undefined) throw new Error(`Missing property category fixture: ${item.categoryCode}`);
    const record = await tx.propertySubcategory.upsert({
      where: { propertyCategoryId_code: { propertyCategoryId, code: item.code } },
      update: { name: item.name, slug: item.slug, sortOrder: item.sortOrder, isActive: true, deletedAt: null },
      create: { uuid: seedUuid('property-subcategory', item.code), propertyCategoryId, code: item.code, name: item.name, slug: item.slug, sortOrder: item.sortOrder },
    });
    subcategoryIds.set(item.code, record.id);
  }

  for (let index = 0; index < FACILITIES.length; index += 1) {
    const [code, name, category] = FACILITIES[index];
    await tx.facility.upsert({
      where: { code },
      update: { name, slug: code.toLowerCase().replaceAll('_', '-'), category, sortOrder: (index + 1) * 10, isActive: true, deletedAt: null },
      create: { uuid: seedUuid('facility', code), code, name, slug: code.toLowerCase().replaceAll('_', '-'), category, sortOrder: (index + 1) * 10 },
    });
  }

  for (let index = 0; index < AMENITIES.length; index += 1) {
    const [code, name, category] = AMENITIES[index];
    await tx.propertyAmenity.upsert({
      where: { code },
      update: { name, category, sortOrder: (index + 1) * 10, isActive: true },
      create: { uuid: seedUuid('property-amenity', code), code, name, category, sortOrder: (index + 1) * 10 },
    });
  }

  return { categoryIds, subcategoryIds };
}

async function seedPropertyAggregate(
  tx: SeedTransaction,
  fixture: (typeof PROPERTY_FIXTURES)[number],
  location: { countryId: bigint; provinceId: bigint; cityId: bigint; districtId: bigint; subdistrictId: bigint },
  categoryIds: Map<string, bigint>,
  subcategoryIds: Map<string, bigint>,
): Promise<void> {
  const propertyType = await tx.propertyType.findUniqueOrThrow({ where: { code: fixture.typeCode }, select: { id: true } });
  const propertyCategoryId = categoryIds.get(fixture.categoryCode);
  const propertySubcategoryId = subcategoryIds.get(fixture.subcategoryCode);
  if (propertyCategoryId === undefined || propertySubcategoryId === undefined) throw new Error(`Missing property catalog for ${fixture.key}`);

  const property = await tx.property.upsert({
    where: { businessCode: fixture.businessCode },
    update: {
      referenceNumber: fixture.referenceNumber,
      propertyTypeId: propertyType.id,
      propertyCategoryId,
      propertySubcategoryId,
      subdistrictId: location.subdistrictId,
      title: fixture.title,
      slug: fixture.slug,
      shortDescription: fixture.shortDescription,
      description: fixture.description,
      status: 'ACTIVE',
      availabilityStatus: 'AVAILABLE',
      availableFrom: SEED_REFERENCE_DATE,
      version: 1,
      publishedAt: SEED_REFERENCE_DATE,
      verifiedAt: SEED_REFERENCE_DATE,
      createdBy: '00000000-0000-5000-8000-000000000001',
      updatedBy: '00000000-0000-5000-8000-000000000001',
      verifiedBy: '00000000-0000-5000-8000-000000000001',
      deletedAt: null,
      deletedBy: null,
    },
    create: {
      uuid: seedUuid('property', fixture.key),
      businessCode: fixture.businessCode,
      referenceNumber: fixture.referenceNumber,
      propertyTypeId: propertyType.id,
      propertyCategoryId,
      propertySubcategoryId,
      subdistrictId: location.subdistrictId,
      title: fixture.title,
      slug: fixture.slug,
      shortDescription: fixture.shortDescription,
      description: fixture.description,
      status: 'ACTIVE',
      availabilityStatus: 'AVAILABLE',
      availableFrom: SEED_REFERENCE_DATE,
      version: 1,
      publishedAt: SEED_REFERENCE_DATE,
      verifiedAt: SEED_REFERENCE_DATE,
      createdBy: '00000000-0000-5000-8000-000000000001',
      updatedBy: '00000000-0000-5000-8000-000000000001',
      verifiedBy: '00000000-0000-5000-8000-000000000001',
    },
  });

  await tx.propertySpecification.upsert({
    where: { propertyId: property.id },
    update: { landArea: fixture.landArea, buildingArea: fixture.buildingArea, bedrooms: fixture.bedrooms, bathrooms: fixture.bathrooms, floors: fixture.floors, parkingSpaces: fixture.parkingSpaces, parkingType: 'GARAGE', yearBuilt: fixture.yearBuilt, condition: 'GOOD', furnishedStatus: fixture.key === 'dago-apartment' ? 'FULLY_FURNISHED' : 'SEMI_FURNISHED' },
    create: { uuid: seedUuid('property-specification', fixture.key), propertyId: property.id, landArea: fixture.landArea, buildingArea: fixture.buildingArea, bedrooms: fixture.bedrooms, bathrooms: fixture.bathrooms, floors: fixture.floors, parkingSpaces: fixture.parkingSpaces, parkingType: 'GARAGE', yearBuilt: fixture.yearBuilt, condition: 'GOOD', furnishedStatus: fixture.key === 'dago-apartment' ? 'FULLY_FURNISHED' : 'SEMI_FURNISHED' },
  });

  await tx.propertyLocation.upsert({
    where: { propertyId: property.id },
    update: { countryId: location.countryId, provinceId: location.provinceId, cityId: location.cityId, districtId: location.districtId, subdistrictId: location.subdistrictId, addressLine: fixture.addressLine, street: fixture.street, neighborhood: fixture.neighborhood, postalCode: fixture.postalCode, latitude: fixture.latitude, longitude: fixture.longitude, coordinateAccuracy: 'APPROXIMATE', mapProvider: 'OPENSTREETMAP', floodRisk: 'LOW', earthquakeRisk: 'MODERATE', trafficRisk: 'MODERATE', noiseRisk: 'LOW', airQualityRisk: 'MODERATE' },
    create: { uuid: seedUuid('property-location', fixture.key), propertyId: property.id, countryId: location.countryId, provinceId: location.provinceId, cityId: location.cityId, districtId: location.districtId, subdistrictId: location.subdistrictId, addressLine: fixture.addressLine, street: fixture.street, neighborhood: fixture.neighborhood, postalCode: fixture.postalCode, latitude: fixture.latitude, longitude: fixture.longitude, coordinateAccuracy: 'APPROXIMATE', mapProvider: 'OPENSTREETMAP', floodRisk: 'LOW', earthquakeRisk: 'MODERATE', trafficRisk: 'MODERATE', noiseRisk: 'LOW', airQualityRisk: 'MODERATE' },
  });

  await tx.propertyBuilding.upsert({
    where: { propertyId: property.id },
    update: { foundation: 'Reinforced concrete', structure: 'Reinforced concrete', walls: 'Brick masonry', roof: 'Concrete roof', flooring: 'Porcelain tile', hasPool: fixture.key === 'senayan-residence', naturalLighting: 'GOOD', ventilation: 'MIXED', smartHome: true, soundproofing: fixture.key === 'senayan-residence' },
    create: { uuid: seedUuid('property-building', fixture.key), propertyId: property.id, foundation: 'Reinforced concrete', structure: 'Reinforced concrete', walls: 'Brick masonry', roof: 'Concrete roof', flooring: 'Porcelain tile', hasPool: fixture.key === 'senayan-residence', naturalLighting: 'GOOD', ventilation: 'MIXED', smartHome: true, soundproofing: fixture.key === 'senayan-residence' },
  });

  await tx.propertyFinancial.upsert({
    where: { propertyId: property.id },
    update: { askingPrice: fixture.askingPrice, currency: 'IDR', negotiable: true, investmentRating: 'B' },
    create: { uuid: seedUuid('property-financial', fixture.key), propertyId: property.id, askingPrice: fixture.askingPrice, currency: 'IDR', negotiable: true, investmentRating: 'B' },
  });
  await tx.propertyFeatures.upsert({
    where: { propertyId: property.id },
    update: { petFriendly: true, childFriendly: true, wheelchairAccessible: true, elderlyFriendly: true, smokingAllowed: false, eventsAllowed: fixture.key === 'senayan-residence', rentalAllowed: true },
    create: { uuid: seedUuid('property-features', fixture.key), propertyId: property.id, petFriendly: true, childFriendly: true, wheelchairAccessible: true, elderlyFriendly: true, smokingAllowed: false, eventsAllowed: fixture.key === 'senayan-residence', rentalAllowed: true },
  });
  await tx.propertySecurity.upsert({
    where: { propertyId: property.id },
    update: { securityGuard: true, cctv: true, accessControl: true, gatedCommunity: fixture.key === 'senayan-residence', smartLock: true, alarmSystem: true },
    create: { uuid: seedUuid('property-security', fixture.key), propertyId: property.id, securityGuard: true, cctv: true, accessControl: true, gatedCommunity: fixture.key === 'senayan-residence', smartLock: true, alarmSystem: true },
  });
  await tx.propertyEnvironment.upsert({
    where: { propertyId: property.id },
    update: { greenBuilding: false, solarPower: fixture.key === 'senayan-residence', rainwaterHarvesting: fixture.key === 'senayan-residence', waterSaving: true },
    create: { uuid: seedUuid('property-environment', fixture.key), propertyId: property.id, greenBuilding: false, solarPower: fixture.key === 'senayan-residence', rainwaterHarvesting: fixture.key === 'senayan-residence', waterSaving: true },
  });
  await tx.propertyUtility.upsert({
    where: { propertyId: property.id },
    update: { electricityProvider: 'PLN', electricityCapacityKva: '13.20', waterSource: 'PDAM', waterBackupSource: 'TANKER', gasType: 'LPG', internetFiber: true, internetProviders: ['IndiHome'], sewageType: 'SEPTIC_TANK', drainageType: 'CLOSED_DRAIN', drainageCondition: 'GOOD', backupPowerType: 'BATTERY', backupPowerCapacityKva: '5.00' },
    create: { uuid: seedUuid('property-utility', fixture.key), propertyId: property.id, electricityProvider: 'PLN', electricityCapacityKva: '13.20', waterSource: 'PDAM', waterBackupSource: 'TANKER', gasType: 'LPG', internetFiber: true, internetProviders: ['IndiHome'], sewageType: 'SEPTIC_TANK', drainageType: 'CLOSED_DRAIN', drainageCondition: 'GOOD', backupPowerType: 'BATTERY', backupPowerCapacityKva: '5.00' },
  });
  await tx.propertyLegal.upsert({
    where: { propertyId: property.id },
    update: { ownershipType: 'INDIVIDUAL', ownershipStatus: 'VERIFIED', verificationStatus: 'VERIFIED', verifiedAt: SEED_REFERENCE_DATE, verifiedBy: '00000000-0000-5000-8000-000000000001', verificationSource: 'SEED_FIXTURE', zoningZone: 'RESIDENTIAL', allowedUse: 'Residential use' },
    create: { uuid: seedUuid('property-legal', fixture.key), propertyId: property.id, ownershipType: 'INDIVIDUAL', ownershipStatus: 'VERIFIED', verificationStatus: 'VERIFIED', verifiedAt: SEED_REFERENCE_DATE, verifiedBy: '00000000-0000-5000-8000-000000000001', verificationSource: 'SEED_FIXTURE', zoningZone: 'RESIDENTIAL', allowedUse: 'Residential use' },
  });
  await tx.propertyOwner.upsert({
    where: { propertyId: property.id },
    update: { ownerType: 'INDIVIDUAL', displayNameMasked: fixture.key === 'senayan-residence' ? 'A*** F******' : 'S*** O*****', referenceHash: checksum(`owner:${fixture.key}`) },
    create: { uuid: seedUuid('property-owner', fixture.key), propertyId: property.id, ownerType: 'INDIVIDUAL', displayNameMasked: fixture.key === 'senayan-residence' ? 'A*** F******' : 'S*** O*****', referenceHash: checksum(`owner:${fixture.key}`) },
  });
  await tx.propertySeo.upsert({
    where: { propertyId: property.id },
    update: { title: fixture.title, description: fixture.shortDescription, keywords: ['property', fixture.categoryCode.toLowerCase(), 'estate-pro'], canonicalUrl: `https://estate-pro.example.test/properties/${fixture.slug}`, ogImageUrl: `https://images.example.test/properties/${fixture.slug}.jpg`, robots: 'INDEX_FOLLOW', metadataVersion: '1.0', schemaType: 'Residence', source: 'SEED' },
    create: { uuid: seedUuid('property-seo', fixture.key), propertyId: property.id, title: fixture.title, description: fixture.shortDescription, keywords: ['property', fixture.categoryCode.toLowerCase(), 'estate-pro'], canonicalUrl: `https://estate-pro.example.test/properties/${fixture.slug}`, ogImageUrl: `https://images.example.test/properties/${fixture.slug}.jpg`, robots: 'INDEX_FOLLOW', metadataVersion: '1.0', schemaType: 'Residence', source: 'SEED' },
  });

  for (const [index, [roomType, name, floor, area]] of [
    ['MASTER_BEDROOM', 'Master Bedroom', 2, '28.00'],
    ['BEDROOM', 'Bedroom 2', 2, '18.00'],
    ['LIVING_ROOM', 'Living Room', 1, '35.00'],
  ] as const) {
    await tx.propertyRoom.upsert({
      where: { uuid: seedUuid('property-room', `${fixture.key}:${index}`) },
      update: { propertyId: property.id, roomType, name, floor, area, areaUnit: 'SQM', hasBathroom: roomType === 'MASTER_BEDROOM', hasWalkInCloset: roomType === 'MASTER_BEDROOM', hasBalcony: fixture.key === 'dago-apartment' && roomType === 'MASTER_BEDROOM', hasAirConditioning: true, sortOrder: index },
      create: { uuid: seedUuid('property-room', `${fixture.key}:${index}`), propertyId: property.id, roomType, name, floor, area, areaUnit: 'SQM', hasBathroom: roomType === 'MASTER_BEDROOM', hasWalkInCloset: roomType === 'MASTER_BEDROOM', hasBalcony: fixture.key === 'dago-apartment' && roomType === 'MASTER_BEDROOM', hasAirConditioning: true, sortOrder: index },
    });
  }

  const facilityCodes = fixture.key === 'senayan-residence' ? ['CCTV', 'SECURITY_GUARD', 'GATED_ACCESS', 'COVERED_PARKING', 'GENERATOR', 'FIBER_INTERNET', 'SWIMMING_POOL'] : ['CCTV', 'SECURITY_GUARD', 'COVERED_PARKING', 'FIBER_INTERNET', 'SWIMMING_POOL', 'ELEVATOR'];
  for (const code of facilityCodes) {
    const facility = await tx.facility.findUniqueOrThrow({ where: { code }, select: { id: true } });
    await tx.propertyFacility.upsert({
      where: { propertyId_facilityId: { propertyId: property.id, facilityId: facility.id } },
      update: { available: true, quantity: 1 },
      create: { propertyId: property.id, facilityId: facility.id, available: true, quantity: 1 },
    });
  }

  const amenityCodes = fixture.key === 'senayan-residence' ? ['AIR_CONDITIONING', 'BUILT_IN_KITCHEN', 'CCTV', 'COVERED_PARKING', 'GARDEN', 'SWIMMING_POOL', 'WIFI', 'SMART_HOME'] : ['AIR_CONDITIONING', 'BALCONY', 'BUILT_IN_KITCHEN', 'CCTV', 'SWIMMING_POOL', 'WIFI', 'SMART_HOME'];
  for (const code of amenityCodes) {
    const amenity = await tx.propertyAmenity.findUniqueOrThrow({ where: { code }, select: { id: true } });
    await tx.propertyAmenityAssignment.upsert({
      where: { propertyId_amenityId: { propertyId: property.id, amenityId: amenity.id } },
      update: { available: true },
      create: { propertyId: property.id, amenityId: amenity.id, available: true },
    });
  }

  await tx.propertyCertificate.upsert({
    where: { propertyId_numberHash: { propertyId: property.id, numberHash: checksum(`SHM:${fixture.key}`) } },
    update: { type: 'SHM', numberMasked: `01******${fixture.key.length}`, status: 'VALID', issueDate: new Date('2020-01-01T00:00:00.000Z'), issuer: 'BPN' },
    create: { uuid: seedUuid('property-certificate', fixture.key), propertyId: property.id, type: 'SHM', numberHash: checksum(`SHM:${fixture.key}`), numberMasked: `01******${fixture.key.length}`, status: 'VALID', issueDate: new Date('2020-01-01T00:00:00.000Z'), issuer: 'BPN' },
  });

  const document = await tx.propertyDocument.upsert({
    where: { uuid: seedUuid('property-document', fixture.key) },
    update: { propertyId: property.id, classification: 'LEGAL', title: 'Proof of Ownership', visibility: 'RESTRICTED', status: 'ACTIVE', currentVersion: 1 },
    create: { uuid: seedUuid('property-document', fixture.key), propertyId: property.id, classification: 'LEGAL', title: 'Proof of Ownership', visibility: 'RESTRICTED', status: 'ACTIVE', currentVersion: 1 },
  });
  await tx.propertyDocumentVersion.upsert({
    where: { documentId_version: { documentId: document.id, version: 1 } },
    update: { storageProvider: 'seed', storageKey: `seed/${fixture.slug}/ownership.pdf`, mimeType: 'application/pdf', extension: 'pdf', fileSizeBytes: 2048, checksumSha256: checksum(`document:${fixture.key}`) },
    create: { uuid: seedUuid('property-document-version', fixture.key), documentId: document.id, version: 1, storageProvider: 'seed', storageKey: `seed/${fixture.slug}/ownership.pdf`, mimeType: 'application/pdf', extension: 'pdf', fileSizeBytes: 2048, checksumSha256: checksum(`document:${fixture.key}`) },
  });

  await tx.propertyMedia.upsert({
    where: { uuid: seedUuid('property-media', fixture.key) },
    update: { propertyId: property.id, type: 'IMAGE', category: 'EXTERIOR', url: `https://images.example.test/properties/${fixture.slug}.jpg`, thumbnailUrl: `https://images.example.test/properties/${fixture.slug}-thumb.jpg`, mimeType: 'image/jpeg', extension: 'jpg', sortOrder: 0, isCover: true, provider: 'seed' },
    create: { uuid: seedUuid('property-media', fixture.key), propertyId: property.id, type: 'IMAGE', category: 'EXTERIOR', url: `https://images.example.test/properties/${fixture.slug}.jpg`, thumbnailUrl: `https://images.example.test/properties/${fixture.slug}-thumb.jpg`, mimeType: 'image/jpeg', extension: 'jpg', sortOrder: 0, isCover: true, provider: 'seed' },
  });

  const listing = await tx.propertyListing.upsert({
    where: { listingCode: `LIST-${fixture.businessCode}` },
    update: { propertyId: property.id, transactionType: 'SALE', status: 'PUBLISHED', visibility: 'PUBLIC', featured: true, premium: fixture.key === 'senayan-residence', verifiedAt: SEED_REFERENCE_DATE, verifiedBy: '00000000-0000-5000-8000-000000000001', publishedAt: SEED_REFERENCE_DATE, version: 1, createdBy: '00000000-0000-5000-8000-000000000001', updatedBy: '00000000-0000-5000-8000-000000000001' },
    create: { uuid: seedUuid('property-listing', fixture.key), propertyId: property.id, listingCode: `LIST-${fixture.businessCode}`, transactionType: 'SALE', status: 'PUBLISHED', visibility: 'PUBLIC', featured: true, premium: fixture.key === 'senayan-residence', verifiedAt: SEED_REFERENCE_DATE, verifiedBy: '00000000-0000-5000-8000-000000000001', publishedAt: SEED_REFERENCE_DATE, version: 1, createdBy: '00000000-0000-5000-8000-000000000001', updatedBy: '00000000-0000-5000-8000-000000000001' },
  });
  await tx.propertyListingPrice.upsert({
    where: { listingId: listing.id },
    update: { priceType: 'TOTAL', currency: 'IDR', minPrice: fixture.askingPrice, maxPrice: fixture.askingPrice },
    create: { uuid: seedUuid('property-listing-price', fixture.key), listingId: listing.id, priceType: 'TOTAL', currency: 'IDR', minPrice: fixture.askingPrice, maxPrice: fixture.askingPrice },
  });
  await tx.propertyListingPaymentOption.upsert({
    where: { listingId_optionType: { listingId: listing.id, optionType: 'CASH' } },
    update: { downPaymentPercent: '100.0000', notes: 'Full cash payment.' },
    create: { uuid: seedUuid('property-listing-payment', `${fixture.key}:cash`), listingId: listing.id, optionType: 'CASH', downPaymentPercent: '100.0000', notes: 'Full cash payment.' },
  });
  await tx.propertyListingPaymentOption.upsert({
    where: { listingId_optionType: { listingId: listing.id, optionType: 'MORTGAGE' } },
    update: { downPaymentPercent: '30.0000', tenorMonths: 120, notes: 'Bank mortgage example.' },
    create: { uuid: seedUuid('property-listing-payment', `${fixture.key}:mortgage`), listingId: listing.id, optionType: 'MORTGAGE', downPaymentPercent: '30.0000', tenorMonths: 120, notes: 'Bank mortgage example.' },
  });
  await tx.propertyListingAnalytics.upsert({
    where: { listingId: listing.id },
    update: { viewCount: 125, inquiryCount: 8, shareCount: 12, saveCount: 21 },
    create: { listingId: listing.id, viewCount: 125, inquiryCount: 8, shareCount: 12, saveCount: 21 },
  });

  await tx.propertyAgentAssignment.upsert({
    where: { propertyId_agentUserUuid: { propertyId: property.id, agentUserUuid: fixture.agentUserUuid } },
    update: { agentDisplayName: fixture.agentDisplayName, isPrimary: true, assignedAt: SEED_REFERENCE_DATE, unassignedAt: null, createdBy: '00000000-0000-5000-8000-000000000001', updatedBy: '00000000-0000-5000-8000-000000000001' },
    create: { uuid: seedUuid('property-agent-assignment', fixture.key), propertyId: property.id, agentUserUuid: fixture.agentUserUuid, agentDisplayName: fixture.agentDisplayName, isPrimary: true, assignedAt: SEED_REFERENCE_DATE, createdBy: '00000000-0000-5000-8000-000000000001', updatedBy: '00000000-0000-5000-8000-000000000001' },
  });
  await tx.propertyHistory.upsert({
    where: { uuid: seedUuid('property-history', `${fixture.key}:created`) },
    update: { propertyId: property.id, event: 'CREATED', actorUuid: '00000000-0000-5000-8000-000000000001', summary: 'Seeded property fixture.', occurredAt: SEED_REFERENCE_DATE },
    create: { uuid: seedUuid('property-history', `${fixture.key}:created`), propertyId: property.id, event: 'CREATED', actorUuid: '00000000-0000-5000-8000-000000000001', summary: 'Seeded property fixture.', occurredAt: SEED_REFERENCE_DATE },
  });
}

export async function seedProperty(tx: SeedTransaction): Promise<void> {
  const locations = await seedLocationMaster(tx);
  const { categoryIds, subcategoryIds } = await seedCatalog(tx);

  for (const fixture of PROPERTY_FIXTURES) {
    const location = locations.get(fixture.locationIndex);
    if (!location) throw new Error(`Missing property location fixture index: ${fixture.locationIndex}`);
    await seedPropertyAggregate(tx, fixture, location, categoryIds, subcategoryIds);
  }
}
