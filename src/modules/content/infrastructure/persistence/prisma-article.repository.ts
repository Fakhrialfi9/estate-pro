import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import {
  ArticleType,
  ContentFormat,
  ContentStatus,
  ContentVisibility,
} from '../../../../../prisma/generated/prisma/enums.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import {
  ContentConflictError,
  ContentConcurrencyError,
  ContentNotFoundError,
  ContentValidationError,
} from '../../application/content.errors.js';
import type {
  AuditContext,
  PaginationQuery,
  PagedResult,
} from '../../domain/content.types.js';
import type { ArticleRecord } from '../../domain/repositories/content.repository.js';

const jsonValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

@Injectable()
export class PrismaArticleRepository {
  constructor(private readonly prisma: PrismaService) {}

  private include() {
    return {
      category: { select: { uuid: true, name: true, slug: true } },
      coverMedia: { select: { uuid: true, publicUrl: true, alt: true } },
      tags: {
        include: { tag: { select: { uuid: true, name: true, slug: true } } },
      },
    } as const;
  }

  private map(record: {
    uuid: string;
    title: string;
    slug: string;
    subtitle: string | null;
    excerpt: string | null;
    content: Prisma.JsonValue;
    contentFormat: string;
    type: string;
    status: string;
    visibility: string;
    language: string;
    featured: boolean;
    allowComments: boolean;
    wordCount: number;
    readingTimeMin: number;
    authorUuid: string | null;
    category: { uuid: string; name: string; slug: string } | null;
    coverMedia: {
      uuid: string;
      publicUrl: string | null;
      alt: string | null;
    } | null;
    tags: Array<{ tag: { uuid: string; name: string; slug: string } }>;
    version: number;
    scheduledAt: Date | null;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): ArticleRecord {
    return {
      uuid: record.uuid,
      title: record.title,
      slug: record.slug,
      subtitle: record.subtitle,
      excerpt: record.excerpt,
      content: record.content,
      contentFormat: record.contentFormat,
      type: record.type,
      status: record.status,
      visibility: record.visibility,
      language: record.language,
      featured: record.featured,
      allowComments: record.allowComments,
      wordCount: record.wordCount,
      readingTimeMin: record.readingTimeMin,
      authorUuid: record.authorUuid,
      category: record.category,
      tags: record.tags.map((row) => row.tag),
      coverMedia: record.coverMedia
        ? {
            uuid: record.coverMedia.uuid,
            url: record.coverMedia.publicUrl,
            alt: record.coverMedia.alt,
          }
        : null,
      version: record.version,
      scheduledAt: record.scheduledAt,
      publishedAt: record.publishedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    };
  }

  private async idByUuid(
    tx: Prisma.TransactionClient,
    model: 'category' | 'media',
    uuid: unknown,
  ): Promise<bigint | null> {
    if (typeof uuid !== 'string' || !uuid) return null;
    if (model === 'category') {
      const row = await tx.contentArticleCategory.findFirst({
        where: { uuid, deletedAt: null },
        select: { id: true },
      });
      if (!row) throw new ContentValidationError('Category does not exist');
      return row.id;
    }
    const row = await tx.contentMedia.findFirst({
      where: { uuid, deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new ContentValidationError('Media does not exist');
    return row.id;
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim())
      throw new ContentValidationError(`${field} is invalid`);
    return value.trim();
  }

  private enumStatus(value: unknown): ContentStatus {
    return value === 'IN_REVIEW'
      ? ContentStatus.IN_REVIEW
      : value === 'APPROVED'
        ? ContentStatus.APPROVED
        : value === 'SCHEDULED'
          ? ContentStatus.SCHEDULED
          : value === 'PUBLISHED'
            ? ContentStatus.PUBLISHED
            : value === 'ARCHIVED'
              ? ContentStatus.ARCHIVED
              : value === 'REJECTED'
                ? ContentStatus.REJECTED
                : ContentStatus.DRAFT;
  }
  private enumVisibility(value: unknown): ContentVisibility {
    return value === 'PRIVATE'
      ? ContentVisibility.PRIVATE
      : ContentVisibility.PUBLIC;
  }
  private enumFormat(value: unknown): ContentFormat {
    return value === 'MARKDOWN'
      ? ContentFormat.MARKDOWN
      : value === 'BLOCKS'
        ? ContentFormat.BLOCKS
        : ContentFormat.RICH_TEXT;
  }
  private enumType(value: unknown): ArticleType {
    return value === 'NEWS'
      ? ArticleType.NEWS
      : value === 'PRESS_RELEASE'
        ? ArticleType.PRESS_RELEASE
        : value === 'GUIDE'
          ? ArticleType.GUIDE
          : value === 'CASE_STUDY'
            ? ArticleType.CASE_STUDY
            : ArticleType.ARTICLE;
  }

  async create(
    input: Record<string, unknown>,
    ctx: AuditContext,
  ): Promise<ArticleRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const categoryId = await this.idByUuid(
          tx,
          'category',
          input.categoryUuid,
        );
        const coverMediaId = await this.idByUuid(
          tx,
          'media',
          input.coverMediaUuid,
        );
        const tagUuids = Array.isArray(input.tags)
          ? input.tags.filter(
              (value): value is string => typeof value === 'string',
            )
          : [];
        const tags = tagUuids.length
          ? await tx.contentTag.findMany({
              where: { uuid: { in: tagUuids }, deletedAt: null },
              select: { id: true },
            })
          : [];
        if (tags.length !== tagUuids.length)
          throw new ContentValidationError('One or more tags do not exist');
        const article = await tx.contentArticle.create({
          data: {
            title: this.requiredString(input.title, 'title'),
            slug: this.requiredString(input.slug, 'slug'),
            subtitle:
              typeof input.subtitle === 'string' ? input.subtitle : null,
            excerpt: typeof input.excerpt === 'string' ? input.excerpt : null,
            content: jsonValue(input.content),
            contentFormat: this.enumFormat(input.contentFormat),
            type: this.enumType(input.type),
            status: ContentStatus.DRAFT,
            visibility: this.enumVisibility(input.visibility),
            language:
              typeof input.language === 'string' ? input.language : 'id',
            featured: input.featured === true,
            allowComments: input.allowComments !== false,
            wordCount:
              typeof input.wordCount === 'number' && Number.isFinite(input.wordCount)
                ? input.wordCount
                : 0,
            readingTimeMin:
              typeof input.readingTimeMin === 'number' &&
              Number.isFinite(input.readingTimeMin)
                ? input.readingTimeMin
                : 1,
            ...(categoryId !== null ? { categoryId } : {}),
            ...(coverMediaId !== null ? { coverMediaId } : {}),
            authorUuid:
              typeof input.authorUuid === 'string' ? input.authorUuid : null,
            createdBy: ctx.actorUuid,
          },
          include: this.include(),
        });
        if (tags.length)
          await tx.contentArticleTag.createMany({
            data: tags.map((tag) => ({ articleId: article.id, tagId: tag.id })),
          });
        await tx.contentRevision.create({
          data: {
            entityType: 'article',
            entityUuid: article.uuid,
            version: 1,
            snapshot: jsonValue(article),
            changeSummary:
              typeof input.changeSummary === 'string'
                ? input.changeSummary
                : null,
            createdBy: ctx.actorUuid,
          },
        });
        await tx.contentArticleStatistics.create({
          data: { articleId: article.id },
        });
        if (input.seo && typeof input.seo === 'object')
          await this.upsertSeo(tx, article.uuid, input.seo);
        const created = await tx.contentArticle.findUniqueOrThrow({
          where: { id: article.id },
          include: this.include(),
        });
        return this.map(created);
      });
    } catch (error) {
      this.mapError(error);
    }
  }

  async get(
    uuid: string,
    includeDeleted = false,
  ): Promise<ArticleRecord | null> {
    const row = await this.prisma.contentArticle.findFirst({
      where: { uuid, ...(includeDeleted ? {} : { deletedAt: null }) },
      include: this.include(),
    });
    return row ? this.map(row) : null;
  }

  async list(
    query: PaginationQuery & {
      categoryUuid?: string;
      tagUuid?: string;
      featured?: boolean;
    },
  ): Promise<PagedResult<ArticleRecord>> {
    const page = Math.min(Math.max(query.page ?? 1, 1), 10000);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;
    const where: Prisma.ContentArticleWhereInput = { deletedAt: null };
    if (query.status) where.status = this.enumStatus(query.status);
    if (query.language) where.language = query.language;
    if (query.featured !== undefined) where.featured = query.featured;
    if (query.categoryUuid) where.category = { uuid: query.categoryUuid };
    if (query.tagUuid)
      where.tags = { some: { tag: { uuid: query.tagUuid } } };
    if (query.search?.trim()) {
      const search = query.search.trim().slice(0, 120);
      where.OR = [
        { title: { contains: search } },
        { excerpt: { contains: search } },
      ];
    }
    const sortBy =
      query.sortBy &&
      ['createdAt', 'updatedAt', 'publishedAt', 'title'].includes(query.sortBy)
        ? query.sortBy
        : 'createdAt';
    const direction = query.sortDirection === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.contentArticle.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ [sortBy]: direction }, { id: 'desc' }],
        include: this.include(),
      }),
      this.prisma.contentArticle.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.map(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async update(
    uuid: string,
    input: Record<string, unknown>,
    expectedVersion: number | undefined,
    ctx: AuditContext,
  ): Promise<ArticleRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.contentArticle.findFirst({
          where: { uuid, deletedAt: null },
          include: this.include(),
        });
        if (!current) throw new ContentNotFoundError('Article not found');
        if (
          expectedVersion !== undefined &&
          current.version !== expectedVersion
        )
          throw new ContentConcurrencyError();
        const data: Prisma.ContentArticleUpdateInput = {
          updatedBy: ctx.actorUuid,
          version: { increment: 1 },
        };
        if (input.title !== undefined)
          data.title = this.requiredString(input.title, 'title');
        if (input.slug !== undefined)
          data.slug = this.requiredString(input.slug, 'slug');
        if (input.subtitle !== undefined)
          data.subtitle =
            typeof input.subtitle === 'string' ? input.subtitle : null;
        if (input.excerpt !== undefined)
          data.excerpt =
            typeof input.excerpt === 'string' ? input.excerpt : null;
        if (input.content !== undefined)
          data.content = jsonValue(input.content);
        if (input.contentFormat !== undefined)
          data.contentFormat = this.enumFormat(input.contentFormat);
        if (input.type !== undefined) data.type = this.enumType(input.type);
        if (input.visibility !== undefined)
          data.visibility = this.enumVisibility(input.visibility);
        if (input.language !== undefined)
          data.language = this.requiredString(input.language, 'language');
        if (input.featured !== undefined) {
          if (typeof input.featured !== 'boolean')
            throw new ContentValidationError('featured is invalid');
          data.featured = input.featured;
        }
        if (input.allowComments !== undefined) {
          if (typeof input.allowComments !== 'boolean')
            throw new ContentValidationError('allowComments is invalid');
          data.allowComments = input.allowComments;
        }
        if (input.wordCount !== undefined) {
          if (
            typeof input.wordCount !== 'number' ||
            !Number.isFinite(input.wordCount) ||
            input.wordCount < 0
          )
            throw new ContentValidationError('wordCount is invalid');
          data.wordCount = input.wordCount;
        }
        if (input.readingTimeMin !== undefined) {
          if (
            typeof input.readingTimeMin !== 'number' ||
            !Number.isFinite(input.readingTimeMin) ||
            input.readingTimeMin < 1
          )
            throw new ContentValidationError('readingTimeMin is invalid');
          data.readingTimeMin = input.readingTimeMin;
        }
        if (input.authorUuid !== undefined)
          data.authorUuid =
            typeof input.authorUuid === 'string' ? input.authorUuid : null;
        if (input.categoryUuid !== undefined) {
          const id = await this.idByUuid(tx, 'category', input.categoryUuid);
          data.category =
            id === null ? { disconnect: true } : { connect: { id } };
        }
        if (input.coverMediaUuid !== undefined) {
          const id = await this.idByUuid(tx, 'media', input.coverMediaUuid);
          data.coverMedia =
            id === null ? { disconnect: true } : { connect: { id } };
        }
        const updated = await tx.contentArticle.update({
          where: { id: current.id },
          data,
          include: this.include(),
        });
        if (Array.isArray(input.tags)) {
          const tagUuids = input.tags.filter(
            (value): value is string => typeof value === 'string',
          );
          const tags = tagUuids.length
            ? await tx.contentTag.findMany({
                where: { uuid: { in: tagUuids }, deletedAt: null },
                select: { id: true },
              })
            : [];
          if (tags.length !== tagUuids.length)
            throw new ContentValidationError('One or more tags do not exist');
          await tx.contentArticleTag.deleteMany({
            where: { articleId: current.id },
          });
          if (tags.length)
            await tx.contentArticleTag.createMany({
              data: tags.map((tag) => ({
                articleId: current.id,
                tagId: tag.id,
              })),
            });
        }
        await tx.contentRevision.create({
          data: {
            entityType: 'article',
            entityUuid: updated.uuid,
            version: updated.version,
            snapshot: jsonValue(updated),
            changeSummary:
              typeof input.changeSummary === 'string'
                ? input.changeSummary
                : null,
            createdBy: ctx.actorUuid,
          },
        });
        if (input.seo && typeof input.seo === 'object')
          await this.upsertSeo(tx, updated.uuid, input.seo);
        return this.map(
          await tx.contentArticle.findUniqueOrThrow({
            where: { id: updated.id },
            include: this.include(),
          }),
        );
      });
    } catch (error) {
      this.mapError(error);
    }
  }

  async softDelete(uuid: string, ctx: AuditContext): Promise<void> {
    const result = await this.prisma.contentArticle.updateMany({
      where: { uuid, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedBy: ctx.actorUuid,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new ContentNotFoundError('Article not found');
  }

  async restore(uuid: string, ctx: AuditContext): Promise<ArticleRecord> {
    try {
      const row = await this.prisma.contentArticle.update({
        where: { uuid },
        data: {
          deletedAt: null,
          deletedBy: null,
          updatedBy: ctx.actorUuid,
          version: { increment: 1 },
        },
        include: this.include(),
      });
      return this.map(row);
    } catch (error) {
      this.mapError(error);
    }
  }

  async transition(
    uuid: string,
    status: string,
    ctx: AuditContext,
  ): Promise<ArticleRecord> {
    const next = this.enumStatus(status);
    try {
      const row = await this.prisma.contentArticle.update({
        where: { uuid },
        data: {
          status: next,
          ...(next === ContentStatus.PUBLISHED
            ? {
                publishedAt: new Date(),
                publishedBy: ctx.actorUuid,
                scheduledAt: null,
              }
            : {}),
          updatedBy: ctx.actorUuid,
          version: { increment: 1 },
        },
        include: this.include(),
      });
      return this.map(row);
    } catch (error) {
      this.mapError(error);
    }
  }

  private async upsertSeo(
    tx: Prisma.TransactionClient,
    articleUuid: string,
    input: unknown,
  ): Promise<void> {
    if (!input || typeof input !== 'object')
      throw new ContentValidationError('SEO must be an object');
    const value = input as Record<string, unknown>;
    await tx.contentSeo.upsert({
      where: {
        entityType_entityUuid: {
          entityType: 'article',
          entityUuid: articleUuid,
        },
      },
      update: {
        metaTitle: this.seoString(value.metaTitle),
        metaDescription: this.seoString(value.metaDescription),
        keywords: this.seoString(value.keywords),
        canonicalUrl: this.seoString(value.canonicalUrl),
        robots: this.seoString(value.robots),
        ogTitle: this.seoString(value.ogTitle),
        ogDescription: this.seoString(value.ogDescription),
        ogImageUrl: this.seoString(value.ogImageUrl),
        twitterTitle: this.seoString(value.twitterTitle),
        twitterDescription: this.seoString(value.twitterDescription),
        twitterImageUrl: this.seoString(value.twitterImageUrl),
        structuredData:
          value.structuredData === undefined
            ? undefined
            : jsonValue(value.structuredData),
      },
      create: {
        entityType: 'article',
        entityUuid: articleUuid,
        metaTitle: this.seoString(value.metaTitle),
        metaDescription: this.seoString(value.metaDescription),
        keywords: this.seoString(value.keywords),
        canonicalUrl: this.seoString(value.canonicalUrl),
        robots: this.seoString(value.robots),
        ogTitle: this.seoString(value.ogTitle),
        ogDescription: this.seoString(value.ogDescription),
        ogImageUrl: this.seoString(value.ogImageUrl),
        twitterTitle: this.seoString(value.twitterTitle),
        twitterDescription: this.seoString(value.twitterDescription),
        twitterImageUrl: this.seoString(value.twitterImageUrl),
        structuredData:
          value.structuredData === undefined
            ? undefined
            : jsonValue(value.structuredData),
      },
    });
  }

  private seoString(value: unknown): string | null {
    return typeof value === 'string' ? value.slice(0, 1000) : null;
  }

  private mapError(error: unknown): never {
    if (
      error instanceof ContentNotFoundError ||
      error instanceof ContentConflictError ||
      error instanceof ContentConcurrencyError ||
      error instanceof ContentValidationError
    )
      throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        throw new ContentConflictError('A unique content value already exists');
      if (error.code === 'P2003')
        throw new ContentConflictError(
          'Content is referenced by another record',
        );
      if (error.code === 'P2025')
        throw new ContentNotFoundError('Content not found');
      if (error.code === 'P2034')
        throw new ContentConcurrencyError('Transaction conflict; please retry');
    }
    throw error;
  }
}
