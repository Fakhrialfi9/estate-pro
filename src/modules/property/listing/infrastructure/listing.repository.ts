import { randomUUID, createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import {
  assertListingTransition,
  assertPaymentInvariants,
  assertPricingInvariants,
  assertPublishable,
  derivePricePerSqm,
  type ListingPaymentInput,
  type ListingPricingInput,
  type ListingStatus,
  type PropertyOwnerType,
} from '../domain/listing.types.js';
import type {
  CreateListingInput,
  ListingActor,
  ListingRepository,
  PropertySearchQuery,
  UpdateListingInput,
} from '../domain/listing.repository.js';

export class ListingNotFoundError extends Error {}
export class ListingConflictError extends Error {}
export class ListingStateError extends Error {}
export class ListingValidationError extends Error {}

const actorId = (actor: ListingActor): string | null => actor.actorUuid ?? null;
const trim = (value: string): string => value.trim();
const maskOwner = (value: string): string => {
  const normalized = trim(value);
  if (normalized.length <= 2) return '*'.repeat(normalized.length);
  if (normalized.length <= 5)
    return `${normalized[0]}${'*'.repeat(normalized.length - 2)}${normalized.at(-1) ?? ''}`;
  return `${normalized.slice(0, 2)}${'*'.repeat(Math.max(2, normalized.length - 4))}${normalized.slice(-2)}`;
};
const hashOwner = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
const positiveDecimal = (value: string | null | undefined): boolean =>
  value != null && /^\d+(?:\.\d+)?$/.test(value) && Number(value) > 0;

@Injectable()
export class PrismaListingRepository implements ListingRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async propertyByUuid(
    tx: Prisma.TransactionClient | PrismaService,
    uuid: string,
  ) {
    const property = await tx.property.findFirst({
      where: { uuid, deletedAt: null },
      select: {
        id: true,
        uuid: true,
        title: true,
        slug: true,
        businessCode: true,
        referenceNumber: true,
        propertyTypeId: true,
        propertyCategoryId: true,
        propertySubcategoryId: true,
        subdistrictId: true,
        status: true,
        availabilityStatus: true,
        availableFrom: true,
        availableTo: true,
      },
    });
    if (!property) throw new ListingNotFoundError('Property not found');
    return property;
  }

  private async normalizePricing(
    input: ListingPricingInput,
    propertyId: bigint,
    tx: Prisma.TransactionClient,
  ): Promise<ListingPricingInput> {
    assertPricingInvariants(input);
    if (input.pricePerSqm != null) return input;
    const specification = await tx.propertySpecification.findUnique({
      where: { propertyId },
      select: { landArea: true, buildingArea: true },
    });
    const base = input.maxPrice ?? input.minPrice;
    const area =
      specification?.buildingArea?.toString() ??
      specification?.landArea?.toString();
    return base && area && positiveDecimal(base) && positiveDecimal(area)
      ? { ...input, pricePerSqm: derivePricePerSqm(base, area) }
      : input;
  }

  private validatePayments(payments: readonly ListingPaymentInput[]): void {
    const types = new Set<string>();
    for (const payment of payments) {
      if (types.has(payment.optionType))
        throw new ListingValidationError(
          'Payment option types must be unique per listing',
        );
      types.add(payment.optionType);
      assertPaymentInvariants(payment);
    }
  }

  async create(
    input: CreateListingInput,
    actor: ListingActor,
  ): Promise<unknown> {
    if (!trim(input.listingCode))
      throw new ListingValidationError('Listing code is required');
    if (input.payments) this.validatePayments(input.payments);
    return this.run(() =>
      this.prisma.$transaction(async (tx) => {
        const property = await this.propertyByUuid(tx, input.propertyUuid);
        const price = input.price
          ? await this.normalizePricing(input.price, property.id, tx)
          : undefined;
        return tx.propertyListing.create({
          data: {
            uuid: randomUUID(),
            propertyId: property.id,
            listingCode: trim(input.listingCode),
            transactionType: input.transactionType,
            status: 'DRAFT',
            visibility: input.visibility ?? 'PRIVATE',
            featured: input.featured ?? false,
            premium: input.premium ?? false,
            expiresAt: input.expiresAt ?? null,
            createdBy: actorId(actor),
            updatedBy: actorId(actor),
            price: price
              ? {
                  create: {
                    uuid: randomUUID(),
                    ...price,
                    createdBy: actorId(actor),
                    updatedBy: actorId(actor),
                  },
                }
              : undefined,
            paymentOptions: input.payments?.length
              ? {
                  create: input.payments.map((payment) => ({
                    uuid: randomUUID(),
                    optionType: payment.optionType,
                    downPaymentAmount: payment.downPaymentAmount ?? null,
                    downPaymentPercent: payment.downPaymentPercent ?? null,
                    installmentAmount: payment.installmentAmount ?? null,
                    tenorMonths: payment.tenorMonths ?? null,
                    notes: payment.notes?.trim() || null,
                    createdBy: actorId(actor),
                    updatedBy: actorId(actor),
                  })),
                }
              : undefined,
            analytics: { create: {} },
          },
          select: {
            uuid: true,
            listingCode: true,
            transactionType: true,
            status: true,
            visibility: true,
            featured: true,
            premium: true,
            version: true,
            property: { select: { uuid: true } },
          },
        });
      }),
    );
  }

  async findOne(uuid: string): Promise<unknown> {
    const listing = await this.prisma.propertyListing.findFirst({
      where: { uuid },
      select: {
        uuid: true,
        listingCode: true,
        transactionType: true,
        status: true,
        visibility: true,
        featured: true,
        premium: true,
        verifiedAt: true,
        publishedAt: true,
        expiresAt: true,
        rejectionReason: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        price: {
          select: {
            uuid: true,
            priceType: true,
            currency: true,
            minPrice: true,
            maxPrice: true,
            pricePerSqm: true,
          },
        },
        paymentOptions: {
          orderBy: { optionType: 'asc' },
          select: {
            uuid: true,
            optionType: true,
            downPaymentAmount: true,
            downPaymentPercent: true,
            installmentAmount: true,
            tenorMonths: true,
            notes: true,
          },
        },
      },
    });
    if (!listing) throw new ListingNotFoundError('Listing not found');
    return listing;
  }

  async update(
    uuid: string,
    version: number,
    input: UpdateListingInput,
    actor: ListingActor,
  ): Promise<unknown> {
    if (input.payments) this.validatePayments(input.payments);
    return this.run(() =>
      this.prisma.$transaction(async (tx) => {
        const current = await tx.propertyListing.findFirst({
          where: { uuid },
          select: { id: true, version: true },
        });
        if (!current) throw new ListingNotFoundError('Listing not found');
        if (current.version !== version)
          throw new ListingConflictError('Listing version conflict');
        const price = input.price
          ? await this.normalizePricing(input.price, current.id, tx)
          : undefined;
        const changed = await tx.propertyListing.updateMany({
          where: { uuid, version },
          data: {
            listingCode: input.listingCode?.trim(),
            transactionType: input.transactionType,
            visibility: input.visibility,
            featured: input.featured,
            premium: input.premium,
            expiresAt: input.expiresAt,
            updatedBy: actorId(actor),
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1)
          throw new ListingConflictError('Listing was modified concurrently');
        if (price)
          await tx.propertyListingPrice.upsert({
            where: { listingId: current.id },
            create: {
              uuid: randomUUID(),
              listingId: current.id,
              ...price,
              createdBy: actorId(actor),
              updatedBy: actorId(actor),
            },
            update: { ...price, updatedBy: actorId(actor) },
          });
        if (input.payments) {
          await tx.propertyListingPaymentOption.deleteMany({
            where: { listingId: current.id },
          });
          if (input.payments.length)
            await tx.propertyListingPaymentOption.createMany({
              data: input.payments.map((payment) => ({
                uuid: randomUUID(),
                listingId: current.id,
                optionType: payment.optionType,
                downPaymentAmount: payment.downPaymentAmount ?? null,
                downPaymentPercent: payment.downPaymentPercent ?? null,
                installmentAmount: payment.installmentAmount ?? null,
                tenorMonths: payment.tenorMonths ?? null,
                notes: payment.notes?.trim() || null,
                createdBy: actorId(actor),
                updatedBy: actorId(actor),
              })),
            });
        }
        return tx.propertyListing.findUniqueOrThrow({
          where: { uuid },
          select: {
            uuid: true,
            listingCode: true,
            status: true,
            visibility: true,
            featured: true,
            premium: true,
            version: true,
            expiresAt: true,
          },
        });
      }),
    );
  }

  async transition(
    uuid: string,
    version: number,
    to: ListingStatus,
    actor: ListingActor,
    reason?: string,
  ): Promise<unknown> {
    return this.run(() =>
      this.prisma.$transaction(async (tx) => {
        const current = await tx.propertyListing.findFirst({
          where: { uuid },
          select: {
            id: true,
            uuid: true,
            version: true,
            status: true,
            visibility: true,
            expiresAt: true,
            propertyId: true,
            price: { select: { id: true } },
          },
        });
        if (!current) throw new ListingNotFoundError('Listing not found');
        if (current.version !== version)
          throw new ListingConflictError('Listing version conflict');
        assertListingTransition(current.status, to);
        if (to === 'DRAFT' && current.status === 'IN_REVIEW' && !reason)
          throw new ListingValidationError('Rejection reason is required');
        if (to === 'PUBLISHED') {
          const property = await tx.property.findUniqueOrThrow({
            where: { id: current.propertyId },
            select: { status: true },
          });
          const primaryAgent = await tx.propertyAgentAssignment.findFirst({
            where: {
              propertyId: current.propertyId,
              isPrimary: true,
              unassignedAt: null,
            },
            select: { id: true },
          });
          assertPublishable({
            propertyStatus: property.status,
            visibility: 'PUBLIC',
            hasPrice: current.price !== null,
            hasPrimaryAgent: primaryAgent !== null,
            expiresAt: current.expiresAt,
          });
        }
        const data: Prisma.PropertyListingUpdateManyMutationInput = {
          status: to,
          rejectionReason: to === 'DRAFT' ? (reason ?? null) : null,
          verifiedAt: to === 'VERIFIED' ? new Date() : undefined,
          verifiedBy: to === 'VERIFIED' ? actorId(actor) : undefined,
          publishedAt:
            to === 'PUBLISHED'
              ? new Date()
              : to === 'UNPUBLISHED'
                ? null
                : undefined,
          updatedBy: actorId(actor),
          version: { increment: 1 },
        };
        if (to === 'PUBLISHED') data.visibility = 'PUBLIC';
        if (to === 'UNPUBLISHED') data.visibility = 'PRIVATE';
        const changed = await tx.propertyListing.updateMany({
          where: { uuid, version },
          data,
        });
        if (changed.count !== 1)
          throw new ListingConflictError('Listing was modified concurrently');
        if (to === 'SOLD' || to === 'RENTED') {
          const property = await tx.property.findUniqueOrThrow({
            where: { id: current.propertyId },
            select: { version: true },
          });
          const propertyChanged = await tx.property.updateMany({
            where: { id: current.propertyId, version: property.version },
            data: {
              status: to === 'SOLD' ? 'SOLD' : 'RENTED',
              availabilityStatus: 'UNAVAILABLE',
              updatedBy: actorId(actor),
              version: { increment: 1 },
            },
          });
          if (propertyChanged.count !== 1)
            throw new ListingConflictError(
              'Property was modified concurrently',
            );
        }
        return tx.propertyListing.findUniqueOrThrow({
          where: { uuid },
          select: {
            uuid: true,
            status: true,
            visibility: true,
            version: true,
            verifiedAt: true,
            publishedAt: true,
            expiresAt: true,
            rejectionReason: true,
          },
        });
      }),
    );
  }

  async expireDue(actor: ListingActor): Promise<readonly string[]> {
    const now = new Date();
    return this.run(() =>
      this.prisma.$transaction(async (tx) => {
        const candidates = await tx.propertyListing.findMany({
          where: { status: 'PUBLISHED', expiresAt: { lte: now } },
          select: { uuid: true, version: true },
        });
        const expired: string[] = [];
        for (const candidate of candidates) {
          const changed = await tx.propertyListing.updateMany({
            where: {
              uuid: candidate.uuid,
              version: candidate.version,
              status: 'PUBLISHED',
            },
            data: {
              status: 'EXPIRED',
              visibility: 'PRIVATE',
              updatedBy: actorId(actor),
              version: { increment: 1 },
            },
          });
          if (changed.count === 1) expired.push(candidate.uuid);
        }
        return expired;
      }),
    );
  }

  async duplicate(uuid: string, actor: ListingActor): Promise<unknown> {
    return this.run(() =>
      this.prisma.$transaction(async (tx) => {
        const source = await tx.propertyListing.findFirst({
          where: { uuid },
          include: { property: true, price: true, paymentOptions: true },
        });
        if (!source) throw new ListingNotFoundError('Listing not found');
        const suffix = randomUUID().slice(0, 8);
        const property = await tx.property.create({
          data: {
            uuid: randomUUID(),
            businessCode: `${source.property.businessCode}-CP-${suffix}`.slice(
              0,
              40,
            ),
            referenceNumber:
              `${source.property.referenceNumber}-CP-${suffix}`.slice(0, 80),
            propertyTypeId: source.property.propertyTypeId,
            propertyCategoryId: source.property.propertyCategoryId,
            propertySubcategoryId: source.property.propertySubcategoryId,
            subdistrictId: source.property.subdistrictId,
            title: `${source.property.title} (Copy)`.slice(0, 200),
            slug: `${source.property.slug}-copy-${suffix}`.slice(0, 220),
            shortDescription: source.property.shortDescription,
            description: source.property.description,
            status: 'DRAFT',
            availabilityStatus: 'AVAILABLE',
            availableFrom: source.property.availableFrom,
            availableTo: source.property.availableTo,
            version: 1,
            createdBy: actorId(actor),
            updatedBy: actorId(actor),
          },
          select: { id: true, uuid: true },
        });
        return tx.propertyListing.create({
          data: {
            uuid: randomUUID(),
            propertyId: property.id,
            listingCode: `${source.listingCode}-CP-${suffix}`.slice(0, 80),
            transactionType: source.transactionType,
            status: 'DRAFT',
            visibility: 'PRIVATE',
            featured: false,
            premium: false,
            expiresAt: null,
            createdBy: actorId(actor),
            updatedBy: actorId(actor),
            price: source.price
              ? {
                  create: {
                    uuid: randomUUID(),
                    priceType: source.price.priceType,
                    currency: source.price.currency,
                    minPrice: source.price.minPrice,
                    maxPrice: source.price.maxPrice,
                    pricePerSqm: source.price.pricePerSqm,
                    createdBy: actorId(actor),
                    updatedBy: actorId(actor),
                  },
                }
              : undefined,
            paymentOptions: source.paymentOptions.length
              ? {
                  create: source.paymentOptions.map((payment) => ({
                    uuid: randomUUID(),
                    optionType: payment.optionType,
                    downPaymentAmount: payment.downPaymentAmount,
                    downPaymentPercent: payment.downPaymentPercent,
                    installmentAmount: payment.installmentAmount,
                    tenorMonths: payment.tenorMonths,
                    notes: payment.notes,
                    createdBy: actorId(actor),
                    updatedBy: actorId(actor),
                  })),
                }
              : undefined,
            analytics: { create: {} },
          },
          select: {
            uuid: true,
            listingCode: true,
            status: true,
            version: true,
            property: { select: { uuid: true } },
          },
        });
      }),
    );
  }

  async assignAgent(
    propertyUuid: string,
    agentUserUuid: string,
    agentDisplayName: string,
    primary: boolean,
    actor: ListingActor,
  ): Promise<unknown> {
    return this.run(() =>
      this.prisma.$transaction(async (tx) => {
        const property = await this.propertyByUuid(tx, propertyUuid);
        if (!agentUserUuid || !agentDisplayName.trim())
          throw new ListingValidationError(
            'Agent reference and display name are required',
          );
        if (primary)
          await tx.propertyAgentAssignment.updateMany({
            where: { propertyId: property.id, unassignedAt: null },
            data: { isPrimary: false, updatedBy: actorId(actor) },
          });
        return tx.propertyAgentAssignment.upsert({
          where: {
            propertyId_agentUserUuid: {
              propertyId: property.id,
              agentUserUuid,
            },
          },
          create: {
            uuid: randomUUID(),
            propertyId: property.id,
            agentUserUuid,
            agentDisplayName: agentDisplayName.trim(),
            isPrimary: primary,
            createdBy: actorId(actor),
            updatedBy: actorId(actor),
          },
          update: {
            agentDisplayName: agentDisplayName.trim(),
            isPrimary: primary,
            unassignedAt: null,
            updatedBy: actorId(actor),
          },
          select: {
            uuid: true,
            agentUserUuid: true,
            agentDisplayName: true,
            isPrimary: true,
            assignedAt: true,
          },
        });
      }),
    );
  }

  async changeAgent(
    propertyUuid: string,
    assignmentUuid: string,
    agentUserUuid: string,
    agentDisplayName: string,
    primary: boolean,
    actor: ListingActor,
  ): Promise<unknown> {
    return this.run(() =>
      this.prisma.$transaction(async (tx) => {
        const property = await this.propertyByUuid(tx, propertyUuid);
        const assignment = await tx.propertyAgentAssignment.findFirst({
          where: {
            uuid: assignmentUuid,
            propertyId: property.id,
            unassignedAt: null,
          },
          select: { id: true },
        });
        if (!assignment)
          throw new ListingNotFoundError('Agent assignment not found');
        if (primary)
          await tx.propertyAgentAssignment.updateMany({
            where: { propertyId: property.id, unassignedAt: null },
            data: { isPrimary: false, updatedBy: actorId(actor) },
          });
        return tx.propertyAgentAssignment.update({
          where: { id: assignment.id },
          data: {
            agentUserUuid,
            agentDisplayName: agentDisplayName.trim(),
            isPrimary: primary,
            updatedBy: actorId(actor),
          },
          select: {
            uuid: true,
            agentUserUuid: true,
            agentDisplayName: true,
            isPrimary: true,
            assignedAt: true,
          },
        });
      }),
    );
  }

  async assignOwner(
    propertyUuid: string,
    ownerType: PropertyOwnerType,
    ownerDisplayName: string,
    actor: ListingActor,
  ): Promise<unknown> {
    return this.run(() =>
      this.prisma.$transaction(async (tx) => {
        const property = await this.propertyByUuid(tx, propertyUuid);
        if (!ownerDisplayName.trim())
          throw new ListingValidationError('Owner display name is required');
        return tx.propertyOwner.upsert({
          where: { propertyId: property.id },
          create: {
            uuid: randomUUID(),
            propertyId: property.id,
            ownerType,
            displayNameMasked: maskOwner(ownerDisplayName),
            referenceHash: hashOwner(ownerDisplayName),
            companyNameMasked:
              ownerType === 'COMPANY' ? maskOwner(ownerDisplayName) : null,
            createdBy: actorId(actor),
            updatedBy: actorId(actor),
          },
          update: {
            ownerType,
            displayNameMasked: maskOwner(ownerDisplayName),
            referenceHash: hashOwner(ownerDisplayName),
            companyNameMasked:
              ownerType === 'COMPANY' ? maskOwner(ownerDisplayName) : null,
            updatedBy: actorId(actor),
          },
          select: {
            uuid: true,
            ownerType: true,
            displayNameMasked: true,
            companyNameMasked: true,
          },
        });
      }),
    );
  }

  async getPropertyDetail(
    propertyUuid: string,
    viewerUserUuid?: string,
  ): Promise<unknown> {
    const property = await this.prisma.property.findFirst({
      where: { uuid: propertyUuid, deletedAt: null },
      select: {
        id: true,
        uuid: true,
        businessCode: true,
        referenceNumber: true,
        title: true,
        slug: true,
        shortDescription: true,
        description: true,
        status: true,
        availabilityStatus: true,
        availableFrom: true,
        availableTo: true,
        propertyTypeId: true,
        propertyCategoryId: true,
        version: true,
        publishedAt: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
        propertyType: {
          select: {
            uuid: true,
            code: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
        propertyCategory: {
          select: {
            uuid: true,
            code: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
        propertySubcategory: {
          select: { uuid: true, code: true, name: true, slug: true },
        },
        specification: {
          select: {
            uuid: true,
            landArea: true,
            landAreaUnit: true,
            buildingArea: true,
            buildingAreaUnit: true,
            floorArea: true,
            floorAreaUnit: true,
            bedrooms: true,
            bathrooms: true,
            maidRooms: true,
            guestToilets: true,
            floors: true,
            parkingType: true,
            parkingSpaces: true,
            livingRooms: true,
            familyRooms: true,
            diningRooms: true,
            kitchens: true,
            yearBuilt: true,
            yearRenovated: true,
            orientation: true,
            condition: true,
            furnishedStatus: true,
            ceilingHeightM: true,
            frontageM: true,
            roadWidthM: true,
          },
        },
        location: {
          select: {
            uuid: true,
            addressLine: true,
            street: true,
            building: true,
            block: true,
            unit: true,
            neighborhood: true,
            postalCode: true,
            latitude: true,
            longitude: true,
            coordinateAccuracy: true,
            mapProvider: true,
            placeId: true,
            mapUrl: true,
            floodRisk: true,
            earthquakeRisk: true,
            trafficRisk: true,
            noiseRisk: true,
            airQualityRisk: true,
            country: {
              select: { uuid: true, code: true, name: true, slug: true },
            },
            province: {
              select: { uuid: true, code: true, name: true, slug: true },
            },
            city: {
              select: { uuid: true, code: true, name: true, slug: true },
            },
            district: {
              select: { uuid: true, code: true, name: true, slug: true },
            },
            subdistrict: {
              select: { uuid: true, code: true, name: true, slug: true },
            },
          },
        },
        building: {
          select: {
            uuid: true,
            foundation: true,
            structure: true,
            walls: true,
            roof: true,
            flooring: true,
            doors: true,
            windows: true,
            facade: true,
            garden: true,
            terrace: true,
            balcony: true,
            rooftop: true,
            hasPool: true,
            poolLengthM: true,
            poolWidthM: true,
            poolDepthM: true,
            interiorStyle: true,
            interiorDesign: true,
            naturalLighting: true,
            ventilation: true,
            smartHome: true,
            soundproofing: true,
          },
        },
        rooms: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          select: {
            uuid: true,
            roomType: true,
            name: true,
            floor: true,
            area: true,
            areaUnit: true,
            hasBathroom: true,
            hasWalkInCloset: true,
            hasBalcony: true,
            hasAirConditioning: true,
            sortOrder: true,
          },
        },
        facilities: {
          where: { available: true },
          orderBy: { facilityId: 'asc' },
          select: {
            available: true,
            quantity: true,
            notes: true,
            facility: {
              select: {
                uuid: true,
                code: true,
                name: true,
                slug: true,
                category: true,
                icon: true,
              },
            },
          },
        },
        utilities: {
          select: {
            uuid: true,
            electricityProvider: true,
            electricityCapacityKva: true,
            electricityMeterNumberMasked: true,
            waterSource: true,
            waterBackupSource: true,
            gasType: true,
            internetFiber: true,
            internetProviders: true,
            sewageType: true,
            drainageType: true,
            drainageCondition: true,
            backupPowerType: true,
            backupPowerCapacityKva: true,
          },
        },
        legal: {
          select: {
            uuid: true,
            ownershipType: true,
            ownershipStatus: true,
            verificationStatus: true,
            verifiedAt: true,
            verificationSource: true,
            zoningZone: true,
            allowedUse: true,
            buildingCoverageRatio: true,
            floorAreaRatio: true,
          },
        },
        financial: {
          select: {
            uuid: true,
            askingPrice: true,
            currency: true,
            negotiable: true,
            annualPropertyTax: true,
            monthlyMaintenance: true,
            monthlyUtilityCost: true,
            monthlyServiceCharges: true,
            rentalYield: true,
            annualRentalIncome: true,
            capitalGrowth: true,
            investmentRating: true,
          },
        },
        features: {
          select: {
            uuid: true,
            petFriendly: true,
            childFriendly: true,
            wheelchairAccessible: true,
            elderlyFriendly: true,
            smokingAllowed: true,
            eventsAllowed: true,
            rentalAllowed: true,
          },
        },
        security: {
          select: {
            uuid: true,
            securityGuard: true,
            cctv: true,
            accessControl: true,
            gatedCommunity: true,
            smartLock: true,
            alarmSystem: true,
          },
        },
        environment: {
          select: {
            uuid: true,
            greenBuilding: true,
            solarPower: true,
            rainwaterHarvesting: true,
            waterSaving: true,
            greenCertification: true,
          },
        },
        seo: {
          select: {
            uuid: true,
            title: true,
            description: true,
            canonicalUrl: true,
            ogImageUrl: true,
            robots: true,
            metadataVersion: true,
            schemaType: true,
            source: true,
            tags: true,
          },
        },
        media: {
          orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
          select: {
            uuid: true,
            type: true,
            category: true,
            url: true,
            thumbnailUrl: true,
            mimeType: true,
            widthPx: true,
            heightPx: true,
            durationMs: true,
            sortOrder: true,
            isCover: true,
            provider: true,
          },
        },
        listing: {
          select: {
            uuid: true,
            listingCode: true,
            transactionType: true,
            status: true,
            visibility: true,
            featured: true,
            premium: true,
            verifiedAt: true,
            publishedAt: true,
            expiresAt: true,
            version: true,
            price: {
              select: {
                uuid: true,
                priceType: true,
                currency: true,
                minPrice: true,
                maxPrice: true,
                pricePerSqm: true,
              },
            },
            paymentOptions: {
              orderBy: { optionType: 'asc' },
              select: {
                uuid: true,
                optionType: true,
                downPaymentAmount: true,
                downPaymentPercent: true,
                installmentAmount: true,
                tenorMonths: true,
                notes: true,
              },
            },
            analytics: {
              select: {
                viewCount: true,
                inquiryCount: true,
                shareCount: true,
                saveCount: true,
                updatedAt: true,
              },
            },
            engagements: viewerUserUuid
              ? {
                  where: { userUuid: viewerUserUuid },
                  select: { isSaved: true, viewedAt: true },
                }
              : undefined,
          },
        },
        agentAssignments: {
          where: { unassignedAt: null },
          orderBy: { isPrimary: 'desc' },
          select: {
            uuid: true,
            agentUserUuid: true,
            agentDisplayName: true,
            isPrimary: true,
            assignedAt: true,
          },
        },
        owner: {
          select: {
            uuid: true,
            ownerType: true,
            displayNameMasked: true,
            companyNameMasked: true,
          },
        },
      },
    });
    if (!property) throw new ListingNotFoundError('Property not found');

    const audit = await this.prisma.auditLog.findMany({
      where: { resourceId: propertyUuid, action: { startsWith: 'property.' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { action: true, result: true, reason: true, createdAt: true },
    });

    const related = await this.prisma.property.findMany({
      where: {
        uuid: { not: property.uuid },
        deletedAt: null,
        OR: [
          { propertyTypeId: property.propertyTypeId },
          { propertyCategoryId: property.propertyCategoryId },
        ],
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 8,
      select: {
        uuid: true,
        title: true,
        slug: true,
        status: true,
        availabilityStatus: true,
        propertyType: { select: { uuid: true, name: true } },
        propertyCategory: { select: { uuid: true, name: true } },
        listing: {
          select: {
            listingCode: true,
            transactionType: true,
            status: true,
            price: {
              select: { currency: true, minPrice: true, maxPrice: true },
            },
          },
        },
      },
    });

    return {
      ...property,
      audit,
      related,
      viewerUserUuid: viewerUserUuid ?? null,
    };
  }

  async search(query: PropertySearchQuery): Promise<{
    items: readonly unknown[];
    total: number;
    page: number;
    limit: number;
  }> {
    const limit = Math.min(Math.max(query.limit, 1), 100);
    const page = Math.max(query.page, 1);
    const skip = (page - 1) * limit;
    const where: Prisma.PropertyWhereInput = { deletedAt: null };
    const listingWhere: Prisma.PropertyListingWhereInput = {};

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term } },
        { slug: { contains: term } },
        { businessCode: { contains: term } },
        { referenceNumber: { contains: term } },
        { listing: { is: { listingCode: { contains: term } } } },
      ];
    }
    if (query.typeUuid) where.propertyType = { is: { uuid: query.typeUuid } };
    if (query.categoryUuid)
      where.propertyCategory = { is: { uuid: query.categoryUuid } };
    if (query.subcategoryUuid)
      where.propertySubcategory = { is: { uuid: query.subcategoryUuid } };
    if (
      query.countryUuid ||
      query.provinceUuid ||
      query.cityUuid ||
      query.districtUuid
    )
      where.location = {
        is: {
          country: query.countryUuid
            ? { is: { uuid: query.countryUuid } }
            : undefined,
          province: query.provinceUuid
            ? { is: { uuid: query.provinceUuid } }
            : undefined,
          city: query.cityUuid ? { is: { uuid: query.cityUuid } } : undefined,
          district: query.districtUuid
            ? { is: { uuid: query.districtUuid } }
            : undefined,
        },
      };
    if (
      query.minLandArea ||
      query.maxLandArea ||
      query.minBuildingArea ||
      query.maxBuildingArea ||
      query.minBedrooms !== undefined ||
      query.maxBedrooms !== undefined ||
      query.minBathrooms ||
      query.maxBathrooms
    )
      where.specification = {
        is: {
          landArea:
            query.minLandArea || query.maxLandArea
              ? { gte: query.minLandArea, lte: query.maxLandArea }
              : undefined,
          buildingArea:
            query.minBuildingArea || query.maxBuildingArea
              ? { gte: query.minBuildingArea, lte: query.maxBuildingArea }
              : undefined,
          bedrooms:
            query.minBedrooms !== undefined || query.maxBedrooms !== undefined
              ? { gte: query.minBedrooms, lte: query.maxBedrooms }
              : undefined,
          bathrooms:
            query.minBathrooms || query.maxBathrooms
              ? { gte: query.minBathrooms, lte: query.maxBathrooms }
              : undefined,
        },
      };
    if (query.facilityUuids?.length)
      where.facilities = {
        some: {
          available: true,
          facility: { is: { uuid: { in: [...query.facilityUuids] } } },
        },
      };
    if (query.transactionType)
      listingWhere.transactionType = query.transactionType;
    if (query.listingStatus) listingWhere.status = query.listingStatus;
    if (query.featured !== undefined) listingWhere.featured = query.featured;
    if (query.verified !== undefined)
      listingWhere.verifiedAt = query.verified ? { not: null } : null;
    if (query.minPrice || query.maxPrice)
      listingWhere.price = {
        is: { maxPrice: { gte: query.minPrice, lte: query.maxPrice } },
      };
    if (Object.keys(listingWhere).length) where.listing = { is: listingWhere };

    const direction = query.sortDirection ?? 'desc';
    const orderBy: Prisma.PropertyOrderByWithRelationInput =
      query.sortBy === 'price'
        ? { listing: { price: { maxPrice: direction } } }
        : query.sortBy === 'views'
          ? { listing: { analytics: { viewCount: direction } } }
          : query.sortBy === 'featured'
            ? { listing: { featured: direction } }
            : query.sortBy === 'createdAt'
              ? { createdAt: direction }
              : query.sortBy === 'updatedAt'
                ? { updatedAt: direction }
                : { updatedAt: 'desc' };

    const [total, items] = await Promise.all([
      this.prisma.property.count({ where }),
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy: [orderBy, { id: 'desc' }],
        select: {
          uuid: true,
          businessCode: true,
          referenceNumber: true,
          title: true,
          slug: true,
          status: true,
          availabilityStatus: true,
          createdAt: true,
          updatedAt: true,
          propertyType: { select: { uuid: true, name: true } },
          propertyCategory: { select: { uuid: true, name: true } },
          listing: {
            select: {
              uuid: true,
              listingCode: true,
              transactionType: true,
              status: true,
              visibility: true,
              featured: true,
              premium: true,
              verifiedAt: true,
              publishedAt: true,
              expiresAt: true,
              price: {
                select: {
                  currency: true,
                  minPrice: true,
                  maxPrice: true,
                  pricePerSqm: true,
                },
              },
              analytics: { select: { viewCount: true } },
            },
          },
        },
      }),
    ]);
    return { items, total, page, limit };
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  private mapError(error: unknown): Error {
    if (
      error instanceof ListingNotFoundError ||
      error instanceof ListingConflictError ||
      error instanceof ListingStateError ||
      error instanceof ListingValidationError
    )
      return error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        return new ListingConflictError('Unique listing constraint violated');
      if (error.code === 'P2025')
        return new ListingNotFoundError(
          'Listing or related property not found',
        );
      if (error.code === 'P2003')
        return new ListingValidationError(
          'Referenced property resource is invalid',
        );
    }
    return error instanceof Error
      ? error
      : new Error('Listing persistence operation failed');
  }
}
