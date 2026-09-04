import { Injectable } from '@nestjs/common';
import type { SeoRedirect, SeoResourceSnapshot } from '../domain/seo.types.js';
import type { SeoRepository } from '../domain/repositories/seo.repository.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';

const keywords = (value: unknown): string[] | null =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : null;

const robots = (
  value: string | null | undefined,
): SeoResourceSnapshot['seo']['robots'] => {
  switch (value) {
    case 'INDEX_FOLLOW':
      return 'index,follow';
    case 'NOINDEX_FOLLOW':
      return 'noindex,follow';
    case 'INDEX_NOFOLLOW':
      return 'index,nofollow';
    case 'NOINDEX_NOFOLLOW':
      return 'noindex,nofollow';
    case 'index,follow':
    case 'index,nofollow':
    case 'noindex,follow':
    case 'noindex,nofollow':
      return value;
    default:
      return undefined;
  }
};

@Injectable()
export class PrismaSeoRepository implements SeoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicResource(
    resourceType: 'property' | 'listing' | 'article' | 'page',
    identifier: string,
    language = 'id',
  ): Promise<SeoResourceSnapshot | null> {
    const now = new Date();
    if (resourceType === 'property') {
      const row = await this.prisma.property.findFirst({
        where: {
          slug: identifier,
          status: 'ACTIVE',
          deletedAt: null,
          publishedAt: { not: null },
        },
        select: {
          uuid: true,
          slug: true,
          title: true,
          shortDescription: true,
          updatedAt: true,
          publishedAt: true,
          seo: {
            select: {
              title: true,
              description: true,
              canonicalUrl: true,
              robots: true,
              ogImageUrl: true,
              metadataVersion: true,
              keywords: true,
            },
          },
        },
      });
      return row
        ? {
            resourceType,
            uuid: row.uuid,
            slug: row.slug,
            title: row.title,
            description: row.shortDescription,
            language,
            updatedAt: row.updatedAt,
            publishedAt: row.publishedAt,
            published: true,
            seo: {
              title: row.seo?.title ?? undefined,
              description: row.seo?.description ?? undefined,
              canonicalUrl: row.seo?.canonicalUrl ?? undefined,
              robots: robots(row.seo?.robots),
              metadataVersion: row.seo?.metadataVersion ?? undefined,
              keywords: keywords(row.seo?.keywords),
              openGraph: row.seo?.ogImageUrl
                ? {
                    title: row.seo.title ?? undefined,
                    description: row.seo.description ?? undefined,
                    url: row.seo.canonicalUrl ?? undefined,
                    imageUrl: row.seo.ogImageUrl,
                    type: 'website',
                  }
                : undefined,
            },
          }
        : null;
    }
    if (resourceType === 'listing') {
      const row = await this.prisma.propertyListing.findFirst({
        where: {
          uuid: identifier,
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          publishedAt: { not: null },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          property: {
            status: 'ACTIVE',
            deletedAt: null,
            publishedAt: { not: null },
          },
        },
        select: {
          uuid: true,
          listingCode: true,
          updatedAt: true,
          publishedAt: true,
          property: {
            select: {
              title: true,
              shortDescription: true,
              seo: {
                select: {
                  title: true,
                  description: true,
                  canonicalUrl: true,
                  robots: true,
                  ogImageUrl: true,
                  metadataVersion: true,
                },
              },
            },
          },
        },
      });
      return row
        ? {
            resourceType,
            uuid: row.uuid,
            slug: row.listingCode,
            title: row.property.title,
            description: row.property.shortDescription,
            language,
            updatedAt: row.updatedAt,
            publishedAt: row.publishedAt,
            published: true,
            seo: {
              title: row.property.seo?.title ?? undefined,
              description: row.property.seo?.description ?? undefined,
              canonicalUrl: row.property.seo?.canonicalUrl ?? undefined,
              robots: robots(row.property.seo?.robots),
              metadataVersion: row.property.seo?.metadataVersion ?? undefined,
              openGraph: row.property.seo?.ogImageUrl
                ? {
                    title: row.property.seo.title ?? undefined,
                    description: row.property.seo.description ?? undefined,
                    url: row.property.seo.canonicalUrl ?? undefined,
                    imageUrl: row.property.seo.ogImageUrl,
                    type: 'website',
                  }
                : undefined,
            },
          }
        : null;
    }
    if (resourceType === 'article') {
      const row = await this.prisma.contentArticle.findFirst({
        where: {
          slug: identifier,
          language,
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          deletedAt: null,
        },
        select: {
          uuid: true,
          slug: true,
          title: true,
          excerpt: true,
          updatedAt: true,
          publishedAt: true,
        },
      });
      if (!row) return null;
      const seo = await this.prisma.contentSeo.findFirst({
        where: { entityType: 'article', entityUuid: row.uuid },
        select: {
          metaTitle: true,
          metaDescription: true,
          canonicalUrl: true,
          robots: true,
          ogTitle: true,
          ogDescription: true,
          ogImageUrl: true,
          twitterTitle: true,
          twitterDescription: true,
          twitterImageUrl: true,
        },
      });
      return {
        resourceType,
        uuid: row.uuid,
        slug: row.slug,
        title: row.title,
        description: row.excerpt,
        language,
        updatedAt: row.updatedAt,
        publishedAt: row.publishedAt,
        published: true,
        seo: {
          title: seo?.metaTitle ?? undefined,
          description: seo?.metaDescription ?? undefined,
          canonicalUrl: seo?.canonicalUrl ?? undefined,
          robots: seo?.robots as SeoResourceSnapshot['seo']['robots'],
          openGraph: seo
            ? {
                title: seo.ogTitle ?? undefined,
                description: seo.ogDescription ?? undefined,
                url: seo.canonicalUrl ?? undefined,
                imageUrl: seo.ogImageUrl,
                type: 'article',
              }
            : undefined,
          twitter: seo
            ? {
                title: seo.twitterTitle ?? undefined,
                description: seo.twitterDescription ?? undefined,
                imageUrl: seo.twitterImageUrl,
                card: seo.twitterImageUrl ? 'summary_large_image' : 'summary',
              }
            : undefined,
        },
      };
    }
    const row = await this.prisma.contentPage.findFirst({
      where: {
        slug: identifier,
        language,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        deletedAt: null,
      },
      select: {
        uuid: true,
        slug: true,
        title: true,
        updatedAt: true,
        publishedAt: true,
      },
    });
    if (!row) return null;
    const seo = await this.prisma.contentSeo.findFirst({
      where: { entityType: 'page', entityUuid: row.uuid },
      select: {
        metaTitle: true,
        metaDescription: true,
        canonicalUrl: true,
        robots: true,
        ogTitle: true,
        ogDescription: true,
        ogImageUrl: true,
        twitterTitle: true,
        twitterDescription: true,
        twitterImageUrl: true,
      },
    });
    return {
      resourceType,
      uuid: row.uuid,
      slug: row.slug,
      title: row.title,
      description: null,
      language,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
      published: true,
      seo: {
        title: seo?.metaTitle ?? undefined,
        description: seo?.metaDescription ?? undefined,
        canonicalUrl: seo?.canonicalUrl ?? undefined,
        robots: seo?.robots as SeoResourceSnapshot['seo']['robots'],
        openGraph: seo
          ? {
              title: seo.ogTitle ?? undefined,
              description: seo.ogDescription ?? undefined,
              url: seo.canonicalUrl ?? undefined,
              imageUrl: seo.ogImageUrl,
              type: 'website',
            }
          : undefined,
        twitter: seo
          ? {
              title: seo.twitterTitle ?? undefined,
              description: seo.twitterDescription ?? undefined,
              imageUrl: seo.twitterImageUrl,
              card: seo.twitterImageUrl ? 'summary_large_image' : 'summary',
            }
          : undefined,
      },
    };
  }

  async listPublicResources(): Promise<SeoResourceSnapshot[]> {
    const now = new Date();
    const [properties, listings, articles, pages] = await Promise.all([
      this.prisma.property.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          publishedAt: { not: null },
        },
        select: {
          uuid: true,
          slug: true,
          title: true,
          shortDescription: true,
          updatedAt: true,
          publishedAt: true,
          seo: {
            select: {
              title: true,
              description: true,
              canonicalUrl: true,
              robots: true,
              ogImageUrl: true,
              metadataVersion: true,
              keywords: true,
            },
          },
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.propertyListing.findMany({
        where: {
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          publishedAt: { not: null },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          property: {
            status: 'ACTIVE',
            deletedAt: null,
            publishedAt: { not: null },
          },
        },
        select: {
          uuid: true,
          listingCode: true,
          updatedAt: true,
          publishedAt: true,
          property: {
            select: {
              title: true,
              shortDescription: true,
              seo: {
                select: {
                  title: true,
                  description: true,
                  canonicalUrl: true,
                  robots: true,
                  ogImageUrl: true,
                  metadataVersion: true,
                },
              },
            },
          },
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.contentArticle.findMany({
        where: { status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null },
        select: {
          uuid: true,
          slug: true,
          title: true,
          excerpt: true,
          language: true,
          updatedAt: true,
          publishedAt: true,
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.contentPage.findMany({
        where: { status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null },
        select: {
          uuid: true,
          slug: true,
          title: true,
          language: true,
          updatedAt: true,
          publishedAt: true,
        },
        orderBy: { id: 'asc' },
      }),
    ]);
    return [
      ...properties.map(
        (row): SeoResourceSnapshot => ({
          resourceType: 'property',
          uuid: row.uuid,
          slug: row.slug,
          title: row.title,
          description: row.shortDescription,
          language: 'id',
          updatedAt: row.updatedAt,
          publishedAt: row.publishedAt,
          published: true,
          seo: {
            title: row.seo?.title ?? undefined,
            description: row.seo?.description ?? undefined,
            canonicalUrl: row.seo?.canonicalUrl ?? undefined,
            robots: robots(row.seo?.robots),
            metadataVersion: row.seo?.metadataVersion ?? undefined,
            keywords: keywords(row.seo?.keywords),
            openGraph: row.seo?.ogImageUrl
              ? {
                  title: row.seo.title ?? undefined,
                  description: row.seo.description ?? undefined,
                  url: row.seo.canonicalUrl ?? undefined,
                  imageUrl: row.seo.ogImageUrl,
                  type: 'website',
                }
              : undefined,
          },
        }),
      ),
      ...listings.map(
        (row): SeoResourceSnapshot => ({
          resourceType: 'listing',
          uuid: row.uuid,
          slug: row.listingCode,
          title: row.property.title,
          description: row.property.shortDescription,
          language: 'id',
          updatedAt: row.updatedAt,
          publishedAt: row.publishedAt,
          published: true,
          seo: {
            title: row.property.seo?.title ?? undefined,
            description: row.property.seo?.description ?? undefined,
            canonicalUrl: row.property.seo?.canonicalUrl ?? undefined,
            robots: robots(row.property.seo?.robots),
            metadataVersion: row.property.seo?.metadataVersion ?? undefined,
          },
        }),
      ),
      ...articles.map(
        (row): SeoResourceSnapshot => ({
          resourceType: 'article',
          uuid: row.uuid,
          slug: row.slug,
          title: row.title,
          description: row.excerpt,
          language: row.language,
          updatedAt: row.updatedAt,
          publishedAt: row.publishedAt,
          published: true,
          seo: {},
        }),
      ),
      ...pages.map(
        (row): SeoResourceSnapshot => ({
          resourceType: 'page',
          uuid: row.uuid,
          slug: row.slug,
          title: row.title,
          description: null,
          language: row.language,
          updatedAt: row.updatedAt,
          publishedAt: row.publishedAt,
          published: true,
          seo: {},
        }),
      ),
    ];
  }

  async getRedirect(sourcePath: string): Promise<SeoRedirect | null> {
    const row = await this.prisma.contentRedirect.findFirst({
      where: { sourcePath, isActive: true },
      select: {
        uuid: true,
        sourcePath: true,
        destination: true,
        type: true,
        isActive: true,
      },
    });
    return row
      ? {
          uuid: row.uuid,
          sourcePath: row.sourcePath,
          destination: row.destination,
          statusCode: row.type === 'FOUND' ? 302 : 301,
          isActive: row.isActive,
        }
      : null;
  }

  async listRedirects(): Promise<SeoRedirect[]> {
    const rows = await this.prisma.contentRedirect.findMany({
      where: { isActive: true },
      orderBy: { sourcePath: 'asc' },
      select: {
        uuid: true,
        sourcePath: true,
        destination: true,
        type: true,
        isActive: true,
      },
    });
    return rows.map((row) => ({
      uuid: row.uuid,
      sourcePath: row.sourcePath,
      destination: row.destination,
      statusCode: row.type === 'FOUND' ? 302 : 301,
      isActive: row.isActive,
    }));
  }

  async upsertRedirect(input: {
    sourcePath: string;
    destination: string;
    statusCode: 301 | 302;
    actorUuid: string;
  }): Promise<SeoRedirect> {
    const row = await this.prisma.contentRedirect.upsert({
      where: { sourcePath: input.sourcePath },
      update: {
        destination: input.destination,
        type: input.statusCode === 302 ? 'FOUND' : 'MOVED_PERMANENTLY',
        isActive: true,
        updatedBy: input.actorUuid,
      },
      create: {
        sourcePath: input.sourcePath,
        destination: input.destination,
        type: input.statusCode === 302 ? 'FOUND' : 'MOVED_PERMANENTLY',
        isActive: true,
        createdBy: input.actorUuid,
      },
    });
    return {
      uuid: row.uuid,
      sourcePath: row.sourcePath,
      destination: row.destination,
      statusCode: row.type === 'FOUND' ? 302 : 301,
      isActive: row.isActive,
    };
  }

  async deactivateRedirect(uuid: string, actorUuid: string): Promise<void> {
    await this.prisma.contentRedirect.update({
      where: { uuid },
      data: { isActive: false, updatedBy: actorUuid },
    });
  }

  async upsertPropertyMetadata(
    propertyUuid: string,
    input: {
      title?: string | null;
      description?: string | null;
      canonicalUrl?: string | null;
      robots?:
        | 'INDEX_FOLLOW'
        | 'NOINDEX_FOLLOW'
        | 'INDEX_NOFOLLOW'
        | 'NOINDEX_NOFOLLOW';
      ogImageUrl?: string | null;
      metadataVersion?: string;
    },
    actorUuid: string,
  ): Promise<SeoResourceSnapshot> {
    const property = await this.prisma.property.findUnique({
      where: { uuid: propertyUuid },
      select: { id: true, slug: true },
    });
    if (!property) throw new Error('Property not found');
    await this.prisma.propertySeo.upsert({
      where: { propertyId: property.id },
      update: { ...input, updatedBy: actorUuid },
      create: { propertyId: property.id, ...input, createdBy: actorUuid },
    });
    const result = await this.getPublicResource('property', property.slug);
    if (!result) throw new Error('Property is not publicly indexable');
    return result;
  }

  async upsertContentMetadata(
    resourceType: 'article' | 'page',
    resourceUuid: string,
    input: {
      metaTitle?: string | null;
      metaDescription?: string | null;
      canonicalUrl?: string | null;
      robots?: string | null;
      ogTitle?: string | null;
      ogDescription?: string | null;
      ogImageUrl?: string | null;
      twitterTitle?: string | null;
      twitterDescription?: string | null;
      twitterImageUrl?: string | null;
    },
    actorUuid: string,
  ): Promise<SeoResourceSnapshot> {
    const model =
      resourceType === 'article'
        ? this.prisma.contentArticle
        : this.prisma.contentPage;
    const row = await model.findUnique({
      where: { uuid: resourceUuid },
      select: { uuid: true, slug: true, language: true },
    });
    if (!row) throw new Error('Content not found');
    await this.prisma.contentSeo.upsert({
      where: {
        entityType_entityUuid: {
          entityType: resourceType,
          entityUuid: resourceUuid,
        },
      },
      update: { ...input },
      create: { entityType: resourceType, entityUuid: resourceUuid, ...input },
    });
    const updated = await this.getPublicResource(
      resourceType,
      row.slug,
      row.language,
    );
    if (!updated) throw new Error('Content is not publicly indexable');
    void actorUuid;
    return updated;
  }
}
