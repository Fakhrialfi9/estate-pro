import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import {
  ContentFormat,
  ContentVisibility,
  ModerationStatus,
} from '../../../../../prisma/generated/prisma/enums.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import {
  ContentConflictError,
  ContentNotFoundError,
} from '../../application/content.errors.js';
import type {
  AuditContext,
  ContentResourceType,
} from '../../domain/content.types.js';
import type { ArticleRecord } from '../../domain/repositories/content.repository.js';
import { PrismaArticleRepository } from './prisma-article.repository.js';

const jsonValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const plain = (value: unknown): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !['id', 'deletedBy'].includes(key))
      .map(([key, item]) => [
        key,
        typeof item === 'bigint' ? item.toString() : item,
      ]),
  );

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

@Injectable()
export class PrismaContentOperationsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly articles: PrismaArticleRepository,
  ) {}

  async createRevision(
    type: ContentResourceType,
    entityUuid: string,
    version: number,
    snapshot: unknown,
    summary: string | undefined,
    ctx: AuditContext,
  ): Promise<void> {
    await this.prisma.contentRevision.create({
      data: {
        entityType: type,
        entityUuid,
        version,
        snapshot: jsonValue(snapshot),
        changeSummary: summary ?? null,
        createdBy: ctx.actorUuid,
      },
    });
  }
  async listRevisions(type: ContentResourceType, entityUuid: string) {
    return this.prisma.contentRevision.findMany({
      where: { entityType: type, entityUuid },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      select: {
        uuid: true,
        version: true,
        snapshot: true,
        changeSummary: true,
        createdBy: true,
        createdAt: true,
      },
    });
  }
  async restoreRevision(
    type: ContentResourceType,
    entityUuid: string,
    revisionUuid: string,
    ctx: AuditContext,
  ): Promise<ArticleRecord | Record<string, unknown>> {
    const revision = await this.prisma.contentRevision.findFirst({
      where: { uuid: revisionUuid, entityType: type, entityUuid },
    });
    if (!revision) throw new ContentNotFoundError('Revision not found');
    const snapshot = revision.snapshot as Record<string, unknown>;
    if (type === 'article') {
      const current = await this.articles.get(entityUuid, false);
      if (!current) throw new ContentNotFoundError('Article not found');
      return this.articles.update(
        entityUuid,
        {
          title: snapshot.title,
          slug: snapshot.slug,
          subtitle: snapshot.subtitle,
          excerpt: snapshot.excerpt,
          content: snapshot.content,
          contentFormat: snapshot.contentFormat,
          type: snapshot.type,
          visibility: snapshot.visibility,
          language: snapshot.language,
          featured: snapshot.featured,
          allowComments: snapshot.allowComments,
          status: 'DRAFT',
          version: current.version,
          changeSummary: `Restored revision ${revision.version}`,
        },
        current.version,
        ctx,
      );
    }
    if (type === 'page') {
      const current = await this.prisma.contentPage.findUnique({
        where: { uuid: entityUuid },
      });
      if (!current) throw new ContentNotFoundError('Page not found');
      const updated = await this.prisma.$transaction(async (tx) => {
        const next = await tx.contentPage.update({
          where: { uuid: entityUuid },
          data: {
            title:
              typeof snapshot.title === 'string'
                ? snapshot.title
                : current.title,
            slug:
              typeof snapshot.slug === 'string' ? snapshot.slug : current.slug,
            template: stringOrDefault(snapshot.template, current.template),
            content: jsonValue(snapshot.content),
            contentFormat: stringOrDefault(
              snapshot.contentFormat,
              'RICH_TEXT',
            ) as ContentFormat,
            status: 'DRAFT',
            visibility: stringOrDefault(
              snapshot.visibility,
              'PUBLIC',
            ) as ContentVisibility,
            language: stringOrDefault(snapshot.language, current.language),
            version: { increment: 1 },
            updatedBy: ctx.actorUuid,
          },
        });
        await tx.contentRevision.create({
          data: {
            entityType: 'page',
            entityUuid,
            version: next.version,
            snapshot: jsonValue(next),
            changeSummary: `Restored revision ${revision.version}`,
            createdBy: ctx.actorUuid,
          },
        });
        return next;
      });
      return plain(updated);
    }
    throw new ContentConflictError(
      `Revision restore is unsupported for ${type}`,
    );
  }

  async getPublicArticle(
    slug: string,
    language: string,
  ): Promise<Record<string, unknown> | null> {
    const row = await this.prisma.contentArticle.findFirst({
      where: {
        slug,
        language,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        deletedAt: null,
      },
      include: {
        category: { select: { uuid: true, name: true, slug: true } },
        coverMedia: { select: { uuid: true, publicUrl: true, alt: true } },
        tags: {
          include: { tag: { select: { uuid: true, name: true, slug: true } } },
        },
      },
    });
    if (!row) return null;
    const seo = await this.prisma.contentSeo.findFirst({
      where: { entityType: 'article', entityUuid: row.uuid },
    });
    return {
      uuid: row.uuid,
      title: row.title,
      slug: row.slug,
      subtitle: row.subtitle,
      excerpt: row.excerpt,
      content: row.content,
      contentFormat: row.contentFormat,
      type: row.type,
      status: row.status,
      visibility: row.visibility,
      language: row.language,
      featured: row.featured,
      allowComments: row.allowComments,
      wordCount: row.wordCount,
      readingTimeMin: row.readingTimeMin,
      category: row.category,
      tags: row.tags.map((item) => item.tag),
      coverMedia: row.coverMedia
        ? {
            uuid: row.coverMedia.uuid,
            url: row.coverMedia.publicUrl,
            alt: row.coverMedia.alt,
          }
        : null,
      seo: seo ? plain(seo) : null,
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
    };
  }

  async getPublicPage(
    slug: string,
    language: string,
  ): Promise<Record<string, unknown> | null> {
    const row = await this.prisma.contentPage.findFirst({
      where: {
        slug,
        language,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        deletedAt: null,
      },
    });
    if (!row) return null;
    const seo = await this.prisma.contentSeo.findFirst({
      where: { entityType: 'page', entityUuid: row.uuid },
    });
    return { ...plain(row), seo: seo ? plain(seo) : null };
  }

  async toggle(
    kind: 'like' | 'bookmark',
    articleUuid: string,
    userUuid: string,
  ): Promise<{ active: boolean; count: number }> {
    const article = await this.prisma.contentArticle.findFirst({
      where: { uuid: articleUuid, deletedAt: null },
      select: { id: true },
    });
    if (!article) throw new ContentNotFoundError('Article not found');
    if (kind === 'like') {
      const existing = await this.prisma.contentArticleLike.findUnique({
        where: { articleId_userUuid: { articleId: article.id, userUuid } },
      });
      if (existing)
        await this.prisma.contentArticleLike.delete({
          where: { id: existing.id },
        });
      else
        await this.prisma.contentArticleLike.create({
          data: { articleId: article.id, userUuid },
        });
      const count = await this.prisma.contentArticleLike.count({
        where: { articleId: article.id },
      });
      await this.prisma.contentArticleStatistics.upsert({
        where: { articleId: article.id },
        create: { articleId: article.id, likes: count },
        update: { likes: count },
      });
      return { active: !existing, count };
    }
    const existing = await this.prisma.contentArticleBookmark.findUnique({
      where: { articleId_userUuid: { articleId: article.id, userUuid } },
    });
    if (existing)
      await this.prisma.contentArticleBookmark.delete({
        where: { id: existing.id },
      });
    else
      await this.prisma.contentArticleBookmark.create({
        data: { articleId: article.id, userUuid },
      });
    const count = await this.prisma.contentArticleBookmark.count({
      where: { articleId: article.id },
    });
    await this.prisma.contentArticleStatistics.upsert({
      where: { articleId: article.id },
      create: { articleId: article.id, bookmarks: count },
      update: { bookmarks: count },
    });
    return { active: !existing, count };
  }

  async viewHash(
    articleUuid: string,
    fingerprint: string,
  ): Promise<{ recorded: boolean; views: number; uniqueViewsToday: number }> {
    const article = await this.prisma.contentArticle.findFirst({
      where: {
        uuid: articleUuid,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!article) throw new ContentNotFoundError('Article not found');
    const now = new Date();
    const day = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    let recorded = false;
    try {
      await this.prisma.contentArticleView.create({
        data: { articleId: article.id, fingerprint, viewedDate: day },
      });
      await this.prisma.contentArticleStatistics.upsert({
        where: { articleId: article.id },
        create: { articleId: article.id, views: 1 },
        update: { views: { increment: 1 } },
      });
      recorded = true;
    } catch (error) {
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
      )
        throw error;
    }
    const stats = await this.prisma.contentArticleStatistics.findUniqueOrThrow({
      where: { articleId: article.id },
      select: { views: true },
    });
    const uniqueViewsToday = await this.prisma.contentArticleView.count({
      where: { articleId: article.id, viewedDate: day },
    });
    return { recorded, views: Number(stats.views), uniqueViewsToday };
  }

  async comment(
    articleUuid: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const article = await this.prisma.contentArticle.findFirst({
      where: {
        uuid: articleUuid,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!article) throw new ContentNotFoundError('Article not found');
    const userUuid = typeof input.userUuid === 'string' ? input.userUuid : null;
    if (
      userUuid &&
      (await this.prisma.contentComment.findFirst({
        where: {
          articleId: article.id,
          userUuid,
          createdAt: { gte: new Date(Date.now() - 60000) },
          deletedAt: null,
        },
        select: { id: true },
      }))
    )
      throw new ContentConflictError(
        'Please wait before posting another comment',
      );
    const row = await this.prisma.contentComment.create({
      data: {
        articleId: article.id,
        userUuid,
        parentUuid:
          typeof input.parentUuid === 'string' ? input.parentUuid : null,
        authorName:
          typeof input.authorName === 'string' ? input.authorName : null,
        authorEmail:
          typeof input.authorEmail === 'string' ? input.authorEmail : null,
        content: jsonValue(input.content),
        status: 'PENDING',
      },
    });
    await this.prisma.contentArticleStatistics.upsert({
      where: { articleId: article.id },
      create: { articleId: article.id, comments: 1 },
      update: { comments: { increment: 1 } },
    });
    return plain(row);
  }
  async moderate(
    uuid: string,
    status: string,
    reason: string | undefined,
  ): Promise<Record<string, unknown>> {
    const allowed = new Set(['APPROVED', 'REJECTED', 'SPAM', 'DELETED']);
    if (!allowed.has(status))
      throw new ContentConflictError('Unsupported moderation status');
    const row = await this.prisma.contentComment.update({
      where: { uuid },
      data: {
        status: status as ModerationStatus,
        moderationReason: reason ?? null,
        deletedAt: status === 'DELETED' ? new Date() : null,
      },
    });
    return plain(row);
  }
}
