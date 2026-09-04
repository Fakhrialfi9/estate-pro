import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service.js';
import type {
  PropertySeoPublicAmenity,
  PropertySeoPublicPort,
  PropertySeoPublicSnapshot,
} from '../../common/contracts/property-seo-public.port.js';

const INDEXABLE_ROBOTS = new Set(['INDEX_FOLLOW', 'INDEX_NOFOLLOW']);

@Injectable()
export class PrismaPropertySeoPublicAdapter implements PropertySeoPublicPort {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicProperty(
    uuidOrSlug: string,
  ): Promise<PropertySeoPublicSnapshot | null> {
    const property = await this.prisma.property.findFirst({
      where: {
        AND: [
          { OR: [{ uuid: uuidOrSlug }, { slug: uuidOrSlug }] },
          { status: 'ACTIVE', deletedAt: null, publishedAt: { not: null } },
          {
            OR: [
              { seo: null },
              { seo: { robots: { in: ['INDEX_FOLLOW', 'INDEX_NOFOLLOW'] } } },
            ],
          },
        ],
      },
      select: {
        uuid: true,
        slug: true,
        title: true,
        shortDescription: true,
        status: true,
        availabilityStatus: true,
        publishedAt: true,
        updatedAt: true,
        seo: { select: { canonicalUrl: true, robots: true } },
        financial: { select: { askingPrice: true, currency: true } },
        location: {
          select: {
            addressLine: true,
            city: { select: { name: true } },
            province: { select: { name: true } },
            country: { select: { name: true } },
          },
        },
        media: {
          where: { deletedAt: null },
          select: {
            url: true,
            thumbnailUrl: true,
            type: true,
            isCover: true,
            sortOrder: true,
          },
          orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }],
        },
        agentAssignments: {
          where: { isPrimary: true, unassignedAt: null },
          select: { agentDisplayName: true },
          orderBy: { id: 'asc' },
          take: 1,
        },
        amenityAssignments: {
          where: { available: true, amenity: { isActive: true } },
          select: {
            amenity: { select: { code: true, name: true, category: true } },
          },
          orderBy: [
            { amenity: { sortOrder: 'asc' } },
            { amenity: { name: 'asc' } },
          ],
        },
      },
    });

    if (!property) return null;
    const robots = property.seo?.robots
      ? String(property.seo.robots)
      : 'INDEX_FOLLOW';
    if (!INDEXABLE_ROBOTS.has(robots)) return null;

    const amenities: PropertySeoPublicAmenity[] =
      property.amenityAssignments.map(({ amenity }) => ({
        code: amenity.code,
        name: amenity.name,
        category: amenity.category,
      }));

    return {
      uuid: property.uuid,
      slug: property.slug,
      title: property.title,
      description: property.shortDescription,
      status: property.status,
      availabilityStatus: property.availabilityStatus,
      publishedAt: property.publishedAt,
      updatedAt: property.updatedAt,
      canonicalUrl: property.seo?.canonicalUrl ?? null,
      robots,
      price: property.financial?.askingPrice?.toString() ?? null,
      currency: property.financial?.currency ?? null,
      location: property.location
        ? {
            address: property.location.addressLine,
            city: property.location.city?.name ?? null,
            province: property.location.province?.name ?? null,
            country: property.location.country?.name ?? null,
          }
        : null,
      images: property.media.map((media) => ({
        url: media.url,
        thumbnailUrl: media.thumbnailUrl,
        type: media.type,
        isCover: media.isCover,
        sortOrder: media.sortOrder,
      })),
      amenities,
      agent: property.agentAssignments[0]?.agentDisplayName
        ? { name: property.agentAssignments[0].agentDisplayName }
        : null,
    };
  }
}
