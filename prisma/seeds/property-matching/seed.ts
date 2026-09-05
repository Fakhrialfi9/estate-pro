import type { SeedTransaction } from '../database.ts';
import { seedUuid, SEED_REFERENCE_DATE } from '../shared/ids.ts';

const SUBJECT_TYPE = 'CRM_CONTACT';
const SUBJECT_UUID = seedUuid('crm-contact', 'buyer-01');
const PROPERTY_UUID = seedUuid('property', 'dago-apartment');
const LISTING_UUID = seedUuid('property-listing', 'dago-apartment');

export async function seedPropertyMatching(tx: SeedTransaction): Promise<void> {
  await tx.propertyPreference.upsert({
    where: { subjectType_subjectUuid: { subjectType: SUBJECT_TYPE, subjectUuid: SUBJECT_UUID } },
    update: {
      version: 1, status: 'ACTIVE', transactionTypes: ['SALE'], propertyTypeUuids: [seedUuid('property-type', 'RESIDENTIAL')], propertyCategoryUuids: [seedUuid('property-category', 'APARTMENT')], hardCriteria: { minBedrooms: 1, maxBedrooms: 3, minBathrooms: 1, parkingRequired: true }, countryUuid: seedUuid('country', 'ID'), provinceUuid: seedUuid('province', 'JB'), cityUuid: seedUuid('city', 'BDG'), districtUuid: seedUuid('district', 'CB'), subdistrictUuid: seedUuid('subdistrict', 'DGO'), radiusKm: '10.00', latitude: '-6.8723000', longitude: '107.6139000', budgetMin: '1500000000', budgetMax: '2500000000', budgetCurrency: 'IDR', budgetFrequency: 'TOTAL', tolerancePercent: '5.00', bedroomsMin: 1, bedroomsMax: 3, bathroomsMin: '1.00', bathroomsMax: '3.00', areaSqmMin: '50.00', areaSqmMax: '100.00', parkingSpacesMin: 1, parkingSpacesMax: 2, furnishedStatus: 'FULLY_FURNISHED', condition: 'GOOD', archivedAt: null,
    },
    create: {
      uuid: seedUuid('property-preference', SUBJECT_UUID), subjectType: SUBJECT_TYPE, subjectUuid: SUBJECT_UUID, version: 1, status: 'ACTIVE', transactionTypes: ['SALE'], propertyTypeUuids: [seedUuid('property-type', 'RESIDENTIAL')], propertyCategoryUuids: [seedUuid('property-category', 'APARTMENT')], hardCriteria: { minBedrooms: 1, maxBedrooms: 3, minBathrooms: 1, parkingRequired: true }, countryUuid: seedUuid('country', 'ID'), provinceUuid: seedUuid('province', 'JB'), cityUuid: seedUuid('city', 'BDG'), districtUuid: seedUuid('district', 'CB'), subdistrictUuid: seedUuid('subdistrict', 'DGO'), radiusKm: '10.00', latitude: '-6.8723000', longitude: '107.6139000', budgetMin: '1500000000', budgetMax: '2500000000', budgetCurrency: 'IDR', budgetFrequency: 'TOTAL', tolerancePercent: '5.00', bedroomsMin: 1, bedroomsMax: 3, bathroomsMin: '1.00', bathroomsMax: '3.00', areaSqmMin: '50.00', areaSqmMax: '100.00', parkingSpacesMin: 1, parkingSpacesMax: 2, furnishedStatus: 'FULLY_FURNISHED', condition: 'GOOD',
    },
  });

  await tx.matchScore.upsert({
    where: { subjectType_subjectUuid_listingUuid_algorithmVersion: { subjectType: SUBJECT_TYPE, subjectUuid: SUBJECT_UUID, listingUuid: LISTING_UUID, algorithmVersion: 1 } },
    update: { propertyUuid: PROPERTY_UUID, score: '92.50', calculatedAt: SEED_REFERENCE_DATE },
    create: { uuid: seedUuid('match-score', `${SUBJECT_UUID}:${LISTING_UUID}:1`), subjectType: SUBJECT_TYPE, subjectUuid: SUBJECT_UUID, propertyUuid: PROPERTY_UUID, listingUuid: LISTING_UUID, score: '92.50', algorithmVersion: 1, calculatedAt: SEED_REFERENCE_DATE },
  });

  const recommendationUuid = seedUuid('recommendation', `${SUBJECT_UUID}:1`);
  const recommendation = await tx.recommendation.upsert({
    where: { uuid: recommendationUuid },
    update: { subjectType: SUBJECT_TYPE, subjectUuid: SUBJECT_UUID, preferenceVersion: 1, algorithmVersion: 1, source: 'GENERATED', generatedAt: SEED_REFERENCE_DATE, candidateCount: 1 },
    create: { uuid: recommendationUuid, subjectType: SUBJECT_TYPE, subjectUuid: SUBJECT_UUID, preferenceVersion: 1, algorithmVersion: 1, source: 'GENERATED', generatedAt: SEED_REFERENCE_DATE, candidateCount: 1 },
  });
  const item = await tx.recommendationItem.upsert({
    where: { recommendationId_listingUuid: { recommendationId: recommendation.id, listingUuid: LISTING_UUID } },
    update: { propertyUuid: PROPERTY_UUID, rank: 1, score: '92.50', explanation: { budget: 'within range', location: 'preferred city', bedrooms: 'within range' } },
    create: { uuid: seedUuid('recommendation-item', `${recommendation.uuid}:1`), recommendationId: recommendation.id, propertyUuid: PROPERTY_UUID, listingUuid: LISTING_UUID, rank: 1, score: '92.50', explanation: { budget: 'within range', location: 'preferred city', bedrooms: 'within range' } },
  });
  await tx.recommendationHistory.upsert({
    where: { uuid: seedUuid('recommendation-history', recommendation.uuid) },
    update: { recommendationId: recommendation.id, subjectType: SUBJECT_TYPE, subjectUuid: SUBJECT_UUID, source: 'GENERATED', preferenceVersion: 1, algorithmVersion: 1, candidateCount: 1, generatedAt: SEED_REFERENCE_DATE },
    create: { uuid: seedUuid('recommendation-history', recommendation.uuid), recommendationId: recommendation.id, subjectType: SUBJECT_TYPE, subjectUuid: SUBJECT_UUID, source: 'GENERATED', preferenceVersion: 1, algorithmVersion: 1, candidateCount: 1, generatedAt: SEED_REFERENCE_DATE },
  });
  await tx.matchFeedback.upsert({
    where: { recommendationItemId_subjectType_subjectUuid: { recommendationItemId: item.id, subjectType: SUBJECT_TYPE, subjectUuid: SUBJECT_UUID } },
    update: { propertyUuid: PROPERTY_UUID, listingUuid: LISTING_UUID, feedback: 'INTERESTED' },
    create: { uuid: seedUuid('match-feedback', `${recommendation.uuid}:1`), recommendationItemId: item.id, subjectType: SUBJECT_TYPE, subjectUuid: SUBJECT_UUID, propertyUuid: PROPERTY_UUID, listingUuid: LISTING_UUID, feedback: 'INTERESTED' },
  });
}
