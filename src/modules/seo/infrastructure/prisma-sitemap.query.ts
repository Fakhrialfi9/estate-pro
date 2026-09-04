import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import type { Prisma } from '../../../../prisma/generated/prisma/client.js';
import type {
  SitemapEntry,
  SitemapQuery,
} from '../domain/repositories/sitemap.query.js';

@Injectable()
export class PrismaSitemapQuery implements SitemapQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private baseUrl(): string {
    return this.config
      .getOrThrow<string>('app.publicBaseUrl')
      .replace(/\/$/, '');
  }

  private propertyWhere(): Prisma.PropertyWhereInput {
    return {
      status: 'ACTIVE',
      deletedAt: null,
      publishedAt: { not: null },
      OR: [
        { seo: { is: null } },
        {
          seo: {
            is: {
              robots: { in: ['INDEX_FOLLOW', 'INDEX_NOFOLLOW'] },
            },
          },
        },
      ],
    };
  }

  private listingWhere(now: Date): Prisma.PropertyListingWhereInput {
    return {
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      publishedAt: { not: null },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      property: {
        status: 'ACTIVE',
        deletedAt: null,
        publishedAt: { not: null },
      },
    };
  }

  private contentWhere(): Prisma.ContentArticleWhereInput {
    return {
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      deletedAt: null,
    };
  }

  async count(): Promise<number> {
    const now = new Date();
    const [properties, listings, articles, pages] = await Promise.all([
      this.prisma.property.count({ where: this.propertyWhere() }),
      this.prisma.propertyListing.count({ where: this.listingWhere(now) }),
      this.prisma.contentArticle.count({ where: this.contentWhere() }),
      this.prisma.contentPage.count({ where: this.contentWhere() }),
    ]);
    return properties + listings + articles + pages;
  }

  async page(part: number, chunkSize: number): Promise<SitemapEntry[]> {
    const now = new Date();
    const start = (part - 1) * chunkSize;
    const end = start + chunkSize;
    const propertyCount = await this.prisma.property.count({
      where: this.propertyWhere(),
    });
    const listingCount = await this.prisma.propertyListing.count({
      where: this.listingWhere(now),
    });
    const articleCount = await this.prisma.contentArticle.count({
      where: this.contentWhere(),
    });
    const pageCount = await this.prisma.contentPage.count({
      where: this.contentWhere(),
    });
    const counts = [propertyCount, listingCount, articleCount, pageCount];
    const entries: SitemapEntry[] = [];

    let cursor = 0;
    for (let index = 0; index < counts.length; index += 1) {
      const count = counts[index] ?? 0;
      const typeStart = cursor;
      const typeEnd = cursor + count;
      const overlapStart = Math.max(start, typeStart);
      const overlapEnd = Math.min(end, typeEnd);
      if (overlapStart < overlapEnd) {
        const skip = overlapStart - typeStart;
        const take = overlapEnd - overlapStart;
        if (index === 0) {
          const rows = await this.prisma.property.findMany({
            where: this.propertyWhere(),
            skip,
            take,
            orderBy: { id: 'asc' },
            select: {
              slug: true,
              updatedAt: true,
              seo: { select: { canonicalUrl: true } },
            },
          });
          entries.push(
            ...rows.map((row) => ({
              loc:
                row.seo?.canonicalUrl ??
                `${this.baseUrl()}/properties/${encodeURIComponent(row.slug)}`,
              lastmod: row.updatedAt.toISOString(),
            })),
          );
        } else if (index === 1) {
          const rows = await this.prisma.propertyListing.findMany({
            where: this.listingWhere(now),
            skip,
            take,
            orderBy: { id: 'asc' },
            select: {
              listingCode: true,
              updatedAt: true,
              property: {
                select: { seo: { select: { canonicalUrl: true } } },
              },
            },
          });
          entries.push(
            ...rows.map((row) => ({
              loc:
                row.property.seo?.canonicalUrl ??
                `${this.baseUrl()}/listings/${encodeURIComponent(row.listingCode)}`,
              lastmod: row.updatedAt.toISOString(),
            })),
          );
        } else if (index === 2) {
          const rows = await this.prisma.contentArticle.findMany({
            where: this.contentWhere(),
            skip,
            take,
            orderBy: { id: 'asc' },
            select: { slug: true, updatedAt: true },
          });
          entries.push(
            ...rows.map((row) => ({
              loc: `${this.baseUrl()}/articles/${encodeURIComponent(row.slug)}`,
              lastmod: row.updatedAt.toISOString(),
            })),
          );
        } else {
          const rows = await this.prisma.contentPage.findMany({
            where: {
              status: 'PUBLISHED',
              visibility: 'PUBLIC',
              deletedAt: null,
            },
            skip,
            take,
            orderBy: { id: 'asc' },
            select: { slug: true, updatedAt: true },
          });
          entries.push(
            ...rows.map((row) => ({
              loc: `${this.baseUrl()}/pages/${encodeURIComponent(row.slug)}`,
              lastmod: row.updatedAt.toISOString(),
            })),
          );
        }
      }
      cursor = typeEnd;
      if (cursor >= end) break;
    }

    return entries;
  }
}
