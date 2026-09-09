import type { SeedTransaction } from './database.ts';
import { SEED_REFERENCE_DATE, seedUuid } from './shared/ids.ts';

const SUBJECT_TYPE = 'CRM_CONTACT';
const CONTACT_COUNT = 20;

export async function seedMatchingScenarios(tx: SeedTransaction): Promise<void> {
  const contacts = await tx.crmContact.findMany({ orderBy: { id: 'asc' }, take: CONTACT_COUNT, select: { uuid: true } });
  const properties = await tx.property.findMany({ orderBy: { id: 'asc' }, take: CONTACT_COUNT, select: { uuid: true } });
  const listings = await tx.propertyListing.findMany({
    orderBy: { id: 'asc' },
    take: CONTACT_COUNT,
    select: { uuid: true, property: { select: { uuid: true } } },
  });
  const rule = await tx.matchingRule.findFirstOrThrow({ where: { isActive: true }, orderBy: { version: 'desc' } });
  if (contacts.length < 10 || properties.length < 10 || listings.length < 10) {
    throw new Error('Matching business fixtures require at least 10 contacts, properties and listings');
  }

  for (let index = 0; index < 10; index += 1) {
    const contact = contacts[index];
    const listing = listings[index % listings.length];
    const property = properties[index % properties.length];
    if (!contact || !listing || !property) continue;

    const version = 1;
    const preferenceUuid = seedUuid('property-preference-business', String(index + 1));
    await tx.propertyPreference.upsert({
      where: { subjectType_subjectUuid: { subjectType: SUBJECT_TYPE, subjectUuid: contact.uuid } },
      update: {
        version,
        status: index % 5 === 0 ? 'PAUSED' : 'ACTIVE',
        transactionTypes: [index % 3 === 0 ? 'RENT' : 'SALE'],
        propertyTypeUuids: [seedUuid('property-type', index % 2 === 0 ? 'RESIDENTIAL' : 'COMMERCIAL')],
        propertyCategoryUuids: [seedUuid('property-category', index % 3 === 0 ? 'HOUSE' : index % 3 === 1 ? 'APARTMENT' : 'OFFICE')],
        hardCriteria: { minBedrooms: index % 2, maxBedrooms: 5, minBathrooms: 1, parkingRequired: index % 3 !== 0 },
        countryUuid: seedUuid('country', 'ID'),
        provinceUuid: seedUuid('province', index % 2 === 0 ? 'JB' : 'JK'),
        cityUuid: seedUuid('city', index % 2 === 0 ? 'BDG' : 'JKS'),
        districtUuid: seedUuid('district', index % 2 === 0 ? 'CB' : 'KBY'),
        subdistrictUuid: seedUuid('subdistrict', index % 2 === 0 ? 'DGO' : 'SNY'),
        radiusKm: String(5 + index),
        latitude: index % 2 === 0 ? '-6.8723000' : '-6.2251000',
        longitude: index % 2 === 0 ? '107.6139000' : '106.8029000',
        budgetMin: String(1_200_000_000 + index * 100_000_000),
        budgetMax: String(2_500_000_000 + index * 200_000_000),
        budgetCurrency: 'IDR',
        budgetFrequency: 'TOTAL',
        tolerancePercent: String(3 + index),
        bedroomsMin: index % 3,
        bedroomsMax: 5,
        bathroomsMin: '1.00',
        bathroomsMax: '4.00',
        areaSqmMin: String(40 + index * 5),
        areaSqmMax: String(100 + index * 10),
        parkingSpacesMin: index % 2,
        parkingSpacesMax: 3,
        furnishedStatus: index % 2 === 0 ? 'FULLY_FURNISHED' : 'UNFURNISHED',
        condition: index % 3 === 0 ? 'GOOD' : 'NEW',
        archivedAt: null,
      },
      create: {
        uuid: preferenceUuid,
        subjectType: SUBJECT_TYPE,
        subjectUuid: contact.uuid,
        version,
        status: 'ACTIVE',
        transactionTypes: [index % 3 === 0 ? 'RENT' : 'SALE'],
        propertyTypeUuids: [seedUuid('property-type', index % 2 === 0 ? 'RESIDENTIAL' : 'COMMERCIAL')],
        propertyCategoryUuids: [seedUuid('property-category', index % 3 === 0 ? 'HOUSE' : index % 3 === 1 ? 'APARTMENT' : 'OFFICE')],
        hardCriteria: { minBedrooms: index % 2, maxBedrooms: 5, minBathrooms: 1, parkingRequired: index % 3 !== 0 },
        countryUuid: seedUuid('country', 'ID'),
        provinceUuid: seedUuid('province', index % 2 === 0 ? 'JB' : 'JK'),
        cityUuid: seedUuid('city', index % 2 === 0 ? 'BDG' : 'JKS'),
        districtUuid: seedUuid('district', index % 2 === 0 ? 'CB' : 'KBY'),
        subdistrictUuid: seedUuid('subdistrict', index % 2 === 0 ? 'DGO' : 'SNY'),
        radiusKm: String(5 + index),
        latitude: index % 2 === 0 ? '-6.8723000' : '-6.2251000',
        longitude: index % 2 === 0 ? '107.6139000' : '106.8029000',
        budgetMin: String(1_200_000_000 + index * 100_000_000),
        budgetMax: String(2_500_000_000 + index * 200_000_000),
        budgetCurrency: 'IDR',
        budgetFrequency: 'TOTAL',
        tolerancePercent: String(3 + index),
        bedroomsMin: index % 3,
        bedroomsMax: 5,
        bathroomsMin: '1.00',
        bathroomsMax: '4.00',
        areaSqmMin: String(40 + index * 5),
        areaSqmMax: String(100 + index * 10),
        parkingSpacesMin: index % 2,
        parkingSpacesMax: 3,
        furnishedStatus: index % 2 === 0 ? 'FULLY_FURNISHED' : 'UNFURNISHED',
        condition: index % 3 === 0 ? 'GOOD' : 'NEW',
      },
    });

    const propertyUuid = listing.property.uuid;
    const score = (68 + index * 2.5).toFixed(2);
    await tx.matchScore.upsert({
      where: { subjectType_subjectUuid_listingUuid_algorithmVersion: { subjectType: SUBJECT_TYPE, subjectUuid: contact.uuid, listingUuid: listing.uuid, algorithmVersion: rule.version } },
      update: { propertyUuid, score, calculatedAt: new Date(SEED_REFERENCE_DATE.getTime() + index * 86_400_000) },
      create: { uuid: seedUuid('match-score-business', String(index + 1)), subjectType: SUBJECT_TYPE, subjectUuid: contact.uuid, propertyUuid, listingUuid: listing.uuid, score, algorithmVersion: rule.version, calculatedAt: new Date(SEED_REFERENCE_DATE.getTime() + index * 86_400_000) },
    });

    const recommendationUuid = seedUuid('recommendation-business', String(index + 1));
    const recommendation = await tx.recommendation.upsert({
      where: { uuid: recommendationUuid },
      update: { subjectType: SUBJECT_TYPE, subjectUuid: contact.uuid, preferenceVersion: version, algorithmVersion: rule.version, source: index % 2 === 0 ? 'GENERATED' : 'REFRESHED', generatedAt: new Date(SEED_REFERENCE_DATE.getTime() + index * 86_400_000), candidateCount: 1 + (index % 4) },
      create: { uuid: recommendationUuid, subjectType: SUBJECT_TYPE, subjectUuid: contact.uuid, preferenceVersion: version, algorithmVersion: rule.version, source: index % 2 === 0 ? 'GENERATED' : 'REFRESHED', generatedAt: new Date(SEED_REFERENCE_DATE.getTime() + index * 86_400_000), candidateCount: 1 + (index % 4) },
    });
    const item = await tx.recommendationItem.upsert({
      where: { recommendationId_listingUuid: { recommendationId: recommendation.id, listingUuid: listing.uuid } },
      update: { propertyUuid, rank: 1, score, explanation: { budget: 'within range', location: 'preferred city', property: 'available' } },
      create: { uuid: seedUuid('recommendation-item-business', String(index + 1)), recommendationId: recommendation.id, propertyUuid, listingUuid: listing.uuid, rank: 1, score, explanation: { budget: 'within range', location: 'preferred city', property: 'available' } },
    });
    await tx.recommendationHistory.upsert({
      where: { uuid: seedUuid('recommendation-history-business', String(index + 1)) },
      update: { recommendationId: recommendation.id, subjectType: SUBJECT_TYPE, subjectUuid: contact.uuid, source: recommendation.source, preferenceVersion: version, algorithmVersion: rule.version, candidateCount: recommendation.candidateCount, generatedAt: recommendation.generatedAt },
      create: { uuid: seedUuid('recommendation-history-business', String(index + 1)), recommendationId: recommendation.id, subjectType: SUBJECT_TYPE, subjectUuid: contact.uuid, source: recommendation.source, preferenceVersion: version, algorithmVersion: rule.version, candidateCount: recommendation.candidateCount, generatedAt: recommendation.generatedAt },
    });
    await tx.matchFeedback.upsert({
      where: { recommendationItemId_subjectType_subjectUuid: { recommendationItemId: item.id, subjectType: SUBJECT_TYPE, subjectUuid: contact.uuid } },
      update: { propertyUuid, listingUuid: listing.uuid, feedback: index % 3 === 0 ? 'INTERESTED' : index % 3 === 1 ? 'DISMISSED' : 'VIEWED' },
      create: { uuid: seedUuid('match-feedback-business', String(index + 1)), recommendationItemId: item.id, subjectType: SUBJECT_TYPE, subjectUuid: contact.uuid, propertyUuid, listingUuid: listing.uuid, feedback: index % 3 === 0 ? 'INTERESTED' : index % 3 === 1 ? 'DISMISSED' : 'VIEWED' },
    });
  }
}
