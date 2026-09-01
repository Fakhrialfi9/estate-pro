import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../../../prisma/generated/prisma/client.js';
import type { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import type {
  MatchingRepository,
  StoredPreference,
} from '../application/matching.ports.js';
import type {
  BehavioralSignal,
  MatchCandidate,
  MatchingSubjectType,
  PriceFrequency,
  PropertyPreferenceState,
} from '../domain/matching.types.js';

const candidateSelect = {
  uuid: true,
  transactionType: true,
  publishedAt: true,
  expiresAt: true,
  price: {
    select: { currency: true, priceType: true, minPrice: true, maxPrice: true },
  },
  property: {
    select: {
      uuid: true,
      propertyType: { select: { uuid: true } },
      propertyCategory: { select: { uuid: true } },
      location: {
        select: {
          country: { select: { uuid: true } },
          province: { select: { uuid: true } },
          city: { select: { uuid: true } },
          district: { select: { uuid: true } },
          subdistrict: { select: { uuid: true } },
          latitude: true,
          longitude: true,
        },
      },
      specification: {
        select: {
          bedrooms: true,
          bathrooms: true,
          buildingArea: true,
          parkingSpaces: true,
          furnishedStatus: true,
          condition: true,
        },
      },
    },
  },
} as const;

type CandidateRow = Prisma.PropertyListingGetPayload<{
  select: typeof candidateSelect;
}>;
type PreferenceRow = Prisma.PropertyPreferenceGetPayload<{}>;

const decimalString = (value: Prisma.Decimal | null): string | null =>
  value == null ? null : value.toString();
const decimalNumber = (value: Prisma.Decimal | null): number | null =>
  value == null ? null : Number(value);

const toPreference = (row: PreferenceRow): StoredPreference => ({
  version: row.version,
  status: row.status,
  transactionTypes: Array.isArray(row.transactionTypes)
    ? row.transactionTypes.filter(
        (value): value is PropertyPreferenceState['transactionTypes'][number] =>
          typeof value === 'string',
      )
    : [],
  propertyTypeUuids: Array.isArray(row.propertyTypeUuids)
    ? row.propertyTypeUuids.filter(
        (value): value is string => typeof value === 'string',
      )
    : [],
  propertyCategoryUuids: Array.isArray(row.propertyCategoryUuids)
    ? row.propertyCategoryUuids.filter(
        (value): value is string => typeof value === 'string',
      )
    : [],
  hardCriteria: Array.isArray(row.hardCriteria)
    ? row.hardCriteria.filter(
        (value): value is PropertyPreferenceState['hardCriteria'][number] =>
          typeof value === 'string',
      )
    : [],
  location:
    row.countryUuid ||
    row.provinceUuid ||
    row.cityUuid ||
    row.districtUuid ||
    row.subdistrictUuid ||
    row.latitude != null ||
    row.longitude != null
      ? {
          countryUuid: row.countryUuid ?? undefined,
          provinceUuid: row.provinceUuid ?? undefined,
          cityUuid: row.cityUuid ?? undefined,
          districtUuid: row.districtUuid ?? undefined,
          subdistrictUuid: row.subdistrictUuid ?? undefined,
          radiusKm: decimalNumber(row.radiusKm) ?? undefined,
          latitude: decimalNumber(row.latitude) ?? undefined,
          longitude: decimalNumber(row.longitude) ?? undefined,
        }
      : undefined,
  budget:
    row.budgetCurrency && row.budgetFrequency
      ? {
          min: decimalString(row.budgetMin) ?? undefined,
          max: decimalString(row.budgetMax) ?? undefined,
          currency: row.budgetCurrency,
          frequency: row.budgetFrequency as PriceFrequency,
          tolerancePercent: decimalNumber(row.tolerancePercent) ?? undefined,
        }
      : undefined,
  specification:
    row.bedroomsMin != null ||
    row.bedroomsMax != null ||
    row.bathroomsMin != null ||
    row.bathroomsMax != null ||
    row.areaSqmMin != null ||
    row.areaSqmMax != null ||
    row.parkingSpacesMin != null ||
    row.parkingSpacesMax != null ||
    row.furnishedStatus ||
    row.condition
      ? {
          bedrooms:
            row.bedroomsMin != null || row.bedroomsMax != null
              ? {
                  min: row.bedroomsMin ?? undefined,
                  max: row.bedroomsMax ?? undefined,
                }
              : undefined,
          bathrooms:
            row.bathroomsMin != null || row.bathroomsMax != null
              ? {
                  min: decimalString(row.bathroomsMin) ?? undefined,
                  max: decimalString(row.bathroomsMax) ?? undefined,
                }
              : undefined,
          areaSqm:
            row.areaSqmMin != null || row.areaSqmMax != null
              ? {
                  min: decimalString(row.areaSqmMin) ?? undefined,
                  max: decimalString(row.areaSqmMax) ?? undefined,
                }
              : undefined,
          parkingSpaces:
            row.parkingSpacesMin != null || row.parkingSpacesMax != null
              ? {
                  min: row.parkingSpacesMin ?? undefined,
                  max: row.parkingSpacesMax ?? undefined,
                }
              : undefined,
          furnishedStatus: row.furnishedStatus as never,
          condition: row.condition as never,
        }
      : undefined,
});

export class PrismaPropertyMatchingRepository implements MatchingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPreference(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
  ): Promise<StoredPreference | null> {
    const row = await this.prisma.propertyPreference.findUnique({
      where: { subjectType_subjectUuid: { subjectType, subjectUuid } },
    });
    return row ? toPreference(row) : null;
  }

  async createPreference(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
    preference: PropertyPreferenceState,
  ): Promise<StoredPreference> {
    return toPreference(
      await this.prisma.propertyPreference.create({
        data: this.preferenceData(subjectType, subjectUuid, preference),
      }),
    );
  }

  async updatePreference(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
    expectedVersion: number,
    preference: PropertyPreferenceState,
  ): Promise<StoredPreference> {
    const result = await this.prisma.propertyPreference.updateMany({
      where: {
        subjectType,
        subjectUuid,
        version: expectedVersion,
        status: 'ACTIVE',
      },
      data: {
        ...this.preferenceData(subjectType, subjectUuid, preference),
        version: { increment: 1 },
      },
    });
    if (result.count !== 1)
      throw new ConflictException('Preference version is stale');
    const updated = await this.findPreference(subjectType, subjectUuid);
    if (!updated)
      throw new ConflictException('Preference disappeared during update');
    return updated;
  }

  async archivePreference(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
    expectedVersion: number,
  ): Promise<StoredPreference> {
    const result = await this.prisma.propertyPreference.updateMany({
      where: {
        subjectType,
        subjectUuid,
        version: expectedVersion,
        status: 'ACTIVE',
      },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (result.count !== 1)
      throw new ConflictException('Preference version is stale');
    const archived = await this.findPreference(subjectType, subjectUuid);
    if (!archived)
      throw new ConflictException('Preference disappeared during archive');
    return archived;
  }

  async restorePreference(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
    expectedVersion: number,
    preference: PropertyPreferenceState,
  ): Promise<StoredPreference> {
    const result = await this.prisma.propertyPreference.updateMany({
      where: {
        subjectType,
        subjectUuid,
        version: expectedVersion,
        status: 'ARCHIVED',
      },
      data: {
        ...this.preferenceData(subjectType, subjectUuid, preference),
        version: { increment: 1 },
        status: 'ACTIVE',
        archivedAt: null,
      },
    });
    if (result.count !== 1)
      throw new ConflictException('Preference version is stale');
    const restored = await this.findPreference(subjectType, subjectUuid);
    if (!restored)
      throw new ConflictException('Preference disappeared during restore');
    return restored;
  }

  async listCandidates(input: {
    preference: PropertyPreferenceState;
    now: Date;
    limit: number;
  }): Promise<readonly MatchCandidate[]> {
    const { preference, now, limit } = input;
    const propertyWhere: Prisma.PropertyWhereInput = {
      deletedAt: null,
      status: 'ACTIVE',
      availabilityStatus: 'AVAILABLE',
      ...(preference.hardCriteria.includes('propertyType') &&
      preference.propertyTypeUuids.length
        ? {
            propertyType: {
              is: { uuid: { in: [...preference.propertyTypeUuids] } },
            },
          }
        : {}),
      ...(preference.hardCriteria.includes('propertyCategory') &&
      preference.propertyCategoryUuids.length
        ? {
            propertyCategory: {
              is: { uuid: { in: [...preference.propertyCategoryUuids] } },
            },
          }
        : {}),
    };
    if (preference.hardCriteria.includes('location') && preference.location) {
      propertyWhere.location = {
        is: {
          ...(preference.location.countryUuid
            ? { country: { is: { uuid: preference.location.countryUuid } } }
            : {}),
          ...(preference.location.provinceUuid
            ? { province: { is: { uuid: preference.location.provinceUuid } } }
            : {}),
          ...(preference.location.cityUuid
            ? { city: { is: { uuid: preference.location.cityUuid } } }
            : {}),
          ...(preference.location.districtUuid
            ? { district: { is: { uuid: preference.location.districtUuid } } }
            : {}),
          ...(preference.location.subdistrictUuid
            ? {
                subdistrict: {
                  is: { uuid: preference.location.subdistrictUuid },
                },
              }
            : {}),
        },
      };
    }
    const where: Prisma.PropertyListingWhereInput = {
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      property: { is: propertyWhere },
      ...(preference.hardCriteria.includes('transactionType') &&
      preference.transactionTypes.length
        ? { transactionType: { in: [...preference.transactionTypes] } }
        : {}),
    };
    if (preference.hardCriteria.includes('budget') && preference.budget) {
      const min = preference.budget.min
        ? new Prisma.Decimal(preference.budget.min)
        : null;
      const max = preference.budget.max
        ? new Prisma.Decimal(preference.budget.max)
        : null;
      const tolerance = new Prisma.Decimal(
        Math.round(preference.budget.tolerancePercent ?? 0),
      );
      const low =
        min == null
          ? null
          : min.mul(new Prisma.Decimal(100).sub(tolerance)).div(100);
      const high =
        max == null
          ? null
          : max.mul(new Prisma.Decimal(100).add(tolerance)).div(100);
      where.price = {
        is: {
          currency: preference.budget.currency,
          priceType: preference.budget.frequency,
          ...(high && low
            ? {
                AND: [
                  { OR: [{ minPrice: null }, { minPrice: { lte: high } }] },
                  { OR: [{ maxPrice: null }, { maxPrice: { gte: low } }] },
                ],
              }
            : high
              ? { OR: [{ minPrice: null }, { minPrice: { lte: high } }] }
              : low
                ? { OR: [{ maxPrice: null }, { maxPrice: { gte: low } }] }
                : {}),
        },
      };
    }
    const rows = await this.prisma.propertyListing.findMany({
      where,
      select: candidateSelect,
      orderBy: [{ publishedAt: 'desc' }, { uuid: 'asc' }],
      take: Math.min(500, Math.max(1, limit)),
    });
    return rows.map((row: CandidateRow) => ({
      propertyUuid: row.property.uuid,
      listingUuid: row.uuid,
      propertyTypeUuid: row.property.propertyType.uuid,
      propertyCategoryUuid: row.property.propertyCategory.uuid,
      transactionType: row.transactionType as MatchCandidate['transactionType'],
      listingStatus: 'PUBLISHED',
      visibility: 'PUBLIC',
      publishedAt: row.publishedAt ?? now,
      expiresAt: row.expiresAt,
      price: row.price
        ? {
            currency: row.price.currency,
            priceType: row.price.priceType as PriceFrequency,
            minPrice: decimalString(row.price.minPrice),
            maxPrice: decimalString(row.price.maxPrice),
          }
        : null,
      location: row.property.location
        ? {
            countryUuid: row.property.location.country?.uuid,
            provinceUuid: row.property.location.province?.uuid,
            cityUuid: row.property.location.city?.uuid,
            districtUuid: row.property.location.district?.uuid,
            subdistrictUuid: row.property.location.subdistrict?.uuid,
            latitude: decimalNumber(row.property.location.latitude),
            longitude: decimalNumber(row.property.location.longitude),
          }
        : null,
      specification: row.property.specification
        ? {
            bedrooms: row.property.specification.bedrooms,
            bathrooms: row.property.specification.bathrooms.toString(),
            buildingAreaSqm: decimalString(
              row.property.specification.buildingArea,
            ),
            parkingSpaces: row.property.specification.parkingSpaces,
            furnishedStatus: row.property.specification
              .furnishedStatus as never,
            condition: row.property.specification.condition as never,
          }
        : null,
    }));
  }

  async getSignals(
    subjectUuid: string,
    listingUuids: readonly string[],
  ): Promise<ReadonlyMap<string, BehavioralSignal>> {
    if (listingUuids.length === 0) return new Map();
    const [engagements, analytics] = await Promise.all([
      this.prisma.propertyListingEngagement.findMany({
        where: {
          userUuid: subjectUuid,
          listing: { uuid: { in: [...listingUuids] } },
        },
        select: {
          listing: { select: { uuid: true } },
          isSaved: true,
          viewedAt: true,
        },
      }),
      this.prisma.propertyListingAnalytics.findMany({
        where: { listing: { uuid: { in: [...listingUuids] } } },
        select: {
          listing: { select: { uuid: true } },
          viewCount: true,
          inquiryCount: true,
        },
      }),
    ]);
    const result = new Map<string, BehavioralSignal>(
      listingUuids.map((uuid) => [
        uuid,
        { saved: false, viewedAt: null, inquiryCount: 0, viewCount: 0 },
      ]),
    );
    for (const row of engagements)
      result.set(row.listing.uuid, {
        ...result.get(row.listing.uuid)!,
        saved: row.isSaved,
        viewedAt: row.viewedAt,
      });
    for (const row of analytics)
      result.set(row.listing.uuid, {
        ...result.get(row.listing.uuid)!,
        viewCount: Number(row.viewCount),
        inquiryCount: Number(row.inquiryCount),
      });
    return result;
  }

  async saveRecommendation(input: {
    subjectType: MatchingSubjectType;
    subjectUuid: string;
    preferenceVersion: number;
    algorithmVersion: number;
    source: string;
    candidateCount: number;
    items: readonly {
      propertyUuid: string;
      listingUuid: string;
      rank: number;
      score: number;
      explanation: string;
    }[];
    now: Date;
  }): Promise<{ uuid: string; generatedAt: Date; itemCount: number }> {
    return this.prisma.$transaction(async (tx) => {
      const recommendation = await tx.recommendation.create({
        data: {
          subjectType: input.subjectType,
          subjectUuid: input.subjectUuid,
          preferenceVersion: input.preferenceVersion,
          algorithmVersion: input.algorithmVersion,
          source: input.source as never,
          generatedAt: input.now,
          candidateCount: input.candidateCount,
        },
      });
      await tx.matchScore.deleteMany({
        where: {
          subjectType: input.subjectType,
          subjectUuid: input.subjectUuid,
          algorithmVersion: input.algorithmVersion,
        },
      });
      if (input.items.length > 0) {
        await tx.recommendationItem.createMany({
          data: input.items.map((item) => ({
            recommendationId: recommendation.id,
            propertyUuid: item.propertyUuid,
            listingUuid: item.listingUuid,
            rank: item.rank,
            score: item.score,
            explanation: JSON.parse(item.explanation),
          })),
        });
        await tx.matchScore.createMany({
          data: input.items.map((item) => ({
            subjectType: input.subjectType,
            subjectUuid: input.subjectUuid,
            propertyUuid: item.propertyUuid,
            listingUuid: item.listingUuid,
            score: item.score,
            algorithmVersion: input.algorithmVersion,
            calculatedAt: input.now,
          })),
        });
      }
      await tx.recommendationHistory.create({
        data: {
          recommendationId: recommendation.id,
          subjectType: input.subjectType,
          subjectUuid: input.subjectUuid,
          source: input.source as never,
          preferenceVersion: input.preferenceVersion,
          algorithmVersion: input.algorithmVersion,
          candidateCount: input.candidateCount,
          generatedAt: input.now,
        },
      });
      return {
        uuid: recommendation.uuid,
        generatedAt: recommendation.generatedAt,
        itemCount: input.items.length,
      };
    });
  }

  async getLatestRecommendation(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
  ): Promise<unknown | null> {
    const row = await this.prisma.recommendation.findFirst({
      where: { subjectType, subjectUuid },
      orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }],
      include: {
        items: { orderBy: [{ rank: 'asc' }, { listingUuid: 'asc' }] },
      },
    });
    if (!row) return null;
    const [preference, visible] = await Promise.all([
      this.prisma.propertyPreference.findUnique({
        where: { subjectType_subjectUuid: { subjectType, subjectUuid } },
        select: { version: true },
      }),
      this.prisma.propertyListing.findMany({
        where: {
          uuid: { in: row.items.map((item) => item.listingUuid) },
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          property: {
            is: {
              deletedAt: null,
              status: 'ACTIVE',
              availabilityStatus: 'AVAILABLE',
            },
          },
        },
        select: {
          uuid: true,
          updatedAt: true,
          property: { select: { uuid: true, title: true, updatedAt: true } },
        },
      }),
    ]);
    const visibleByUuid = new Map(visible.map((item) => [item.uuid, item]));
    const stale =
      preference?.version !== row.preferenceVersion ||
      visible.some(
        (item) =>
          item.updatedAt > row.generatedAt ||
          item.property.updatedAt > row.generatedAt,
      );
    return {
      uuid: row.uuid,
      subjectType: row.subjectType,
      subjectUuid: row.subjectUuid,
      preferenceVersion: row.preferenceVersion,
      algorithmVersion: row.algorithmVersion,
      source: row.source,
      generatedAt: row.generatedAt,
      candidateCount: row.candidateCount,
      stale,
      items: row.items
        .filter((item) => visibleByUuid.has(item.listingUuid))
        .map((item) => ({
          uuid: item.uuid,
          propertyUuid: item.propertyUuid,
          listingUuid: item.listingUuid,
          rank: item.rank,
          score: Number(item.score),
          explanation: item.explanation,
        })),
    };
  }

  async listRecommendationHistory(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
    page: number,
    limit: number,
  ) {
    const [items, total] = await Promise.all([
      this.prisma.recommendationHistory.findMany({
        where: { subjectType, subjectUuid },
        orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          uuid: true,
          recommendationId: true,
          source: true,
          preferenceVersion: true,
          algorithmVersion: true,
          candidateCount: true,
          generatedAt: true,
          actorUuid: true,
        },
      }),
      this.prisma.recommendationHistory.count({
        where: { subjectType, subjectUuid },
      }),
    ]);
    return { items, total };
  }

  async recordFeedback(input: {
    recommendationItemUuid: string;
    subjectType: MatchingSubjectType;
    subjectUuid: string;
    propertyUuid: string;
    listingUuid: string;
    feedback: string;
  }) {
    const item = await this.prisma.recommendationItem.findUnique({
      where: { uuid: input.recommendationItemUuid },
      select: {
        id: true,
        propertyUuid: true,
        listingUuid: true,
        recommendation: { select: { subjectType: true, subjectUuid: true } },
      },
    });
    if (
      !item ||
      item.propertyUuid !== input.propertyUuid ||
      item.listingUuid !== input.listingUuid ||
      item.recommendation.subjectType !== input.subjectType ||
      item.recommendation.subjectUuid !== input.subjectUuid
    )
      throw new ConflictException(
        'Recommendation item is outside subject scope',
      );
    return this.prisma.matchFeedback.upsert({
      where: {
        recommendationItemId_subjectType_subjectUuid: {
          recommendationItemId: item.id,
          subjectType: input.subjectType,
          subjectUuid: input.subjectUuid,
        },
      },
      update: { feedback: input.feedback as never },
      create: {
        recommendationItemId: item.id,
        subjectType: input.subjectType,
        subjectUuid: input.subjectUuid,
        propertyUuid: input.propertyUuid,
        listingUuid: input.listingUuid,
        feedback: input.feedback as never,
      },
    });
  }

  async getPreferenceSubjectScope(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
  ): Promise<{ uuid: string; ownerUserUuid: string | null } | null> {
    if (subjectType === 'USER') {
      const user = await this.prisma.authenticationUser.findUnique({
        where: { uuid: subjectUuid },
        select: { uuid: true },
      });
      return user ? { uuid: user.uuid, ownerUserUuid: user.uuid } : null;
    }
    if (subjectType === 'CONTACT')
      return this.prisma.crmContact.findUnique({
        where: { uuid: subjectUuid },
        select: { uuid: true, ownerUserUuid: true },
      });
    return this.prisma.crmLead.findUnique({
      where: { uuid: subjectUuid },
      select: { uuid: true, ownerUserUuid: true },
    });
  }

  async listSavedListings(subjectUuid: string): Promise<readonly unknown[]> {
    const rows = await this.prisma.propertyListingEngagement.findMany({
      where: {
        userUuid: subjectUuid,
        isSaved: true,
        listing: {
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          property: {
            is: {
              deletedAt: null,
              status: 'ACTIVE',
              availabilityStatus: 'AVAILABLE',
            },
          },
        },
      },
      select: {
        listing: {
          select: {
            uuid: true,
            transactionType: true,
            publishedAt: true,
            property: { select: { uuid: true, title: true } },
            price: {
              select: {
                currency: true,
                priceType: true,
                minPrice: true,
                maxPrice: true,
              },
            },
          },
        },
      },
      orderBy: { listing: { publishedAt: 'desc' } },
    });
    return rows.map((row) => row.listing);
  }

  private preferenceData(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
    preference: PropertyPreferenceState,
  ) {
    return {
      subjectType,
      subjectUuid,
      version: preference.version,
      status: 'ACTIVE' as const,
      transactionTypes: preference.transactionTypes,
      propertyTypeUuids: preference.propertyTypeUuids,
      propertyCategoryUuids: preference.propertyCategoryUuids,
      hardCriteria: preference.hardCriteria,
      countryUuid: preference.location?.countryUuid ?? null,
      provinceUuid: preference.location?.provinceUuid ?? null,
      cityUuid: preference.location?.cityUuid ?? null,
      districtUuid: preference.location?.districtUuid ?? null,
      subdistrictUuid: preference.location?.subdistrictUuid ?? null,
      radiusKm: preference.location?.radiusKm ?? null,
      latitude: preference.location?.latitude ?? null,
      longitude: preference.location?.longitude ?? null,
      budgetMin: preference.budget?.min ?? null,
      budgetMax: preference.budget?.max ?? null,
      budgetCurrency: preference.budget?.currency ?? null,
      budgetFrequency: preference.budget?.frequency ?? null,
      tolerancePercent: preference.budget?.tolerancePercent ?? null,
      bedroomsMin: preference.specification?.bedrooms?.min ?? null,
      bedroomsMax: preference.specification?.bedrooms?.max ?? null,
      bathroomsMin: preference.specification?.bathrooms?.min ?? null,
      bathroomsMax: preference.specification?.bathrooms?.max ?? null,
      areaSqmMin: preference.specification?.areaSqm?.min ?? null,
      areaSqmMax: preference.specification?.areaSqm?.max ?? null,
      parkingSpacesMin: preference.specification?.parkingSpaces?.min ?? null,
      parkingSpacesMax: preference.specification?.parkingSpaces?.max ?? null,
      furnishedStatus: preference.specification?.furnishedStatus ?? null,
      condition: preference.specification?.condition ?? null,
    };
  }
}
