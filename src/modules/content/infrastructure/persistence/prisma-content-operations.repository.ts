import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import {
  ContentConflictError,
  ContentNotFoundError,
} from '../application/content.errors.js';
import type {
  AuditContext,
  ContentResourceType,
} from '../domain/content.types.js';
import type { ArticleRecord } from '../domain/repositories/content.repository.js';
import { PrismaArticleRepository } from './persistence/prisma-article.repository.js';

const jsonValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const plain = (value: unknown): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'id' && key !== 'deletedBy')
      .map(([key, item]) => [
        key,
        typeof item === 'bigint' ? item.toString() : item,
      ]),
  );

@Injectable()
export class PrismaContentOperationsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly articles: PrismaArticleRepository,
  ) {}

  async createRevision(
    entityType: ContentResourceType,
    entityUuid: string,
    version: number,
    snapshot: unknown,
    summary: string | undefined,
    ctx: AuditContext,
  ): Promise<void> {
    await this.prisma.contentRevision.create({
      data: {
        entityType,
        entityUuid,
        version,
        snapshot: jsonValue(snapshot),
        changeSummary: summary ?? null,
        createdBy: ctx.actorUuid,
      },
    });
  }
  async listRevisions(entityType: ContentResourceType, entityUuid: string) {
    return this.prisma.contentRevision.findMany({
      where: { entityType, entityUuid },
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
    entityType: ContentResourceType,
    entityUuid: string,
    revisionUuid: string,
    ctx: AuditContext,
  ): Promise<ArticleRecord | Record<string, unknown>> {
    const revision = await this.prisma.contentRevision.findFirst({
      where: { uuid: revisionUuid, entityType, entityUuid },
    });
    if (!revision) throw new ContentNotFoundError('Revision not found');
    const snapshot = revision.snapshot as Record<string, unknown>;
    if (entityType === 'article') {
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
    if (entityType === 'page') {
      const current = await this.prisma.contentPage.findUnique({
        where: { uuid: entityUuid },
      });
      if (!current) throw new ContentNotFoundError('Page not found');
      const updated = await this.prisma.contentPage.update({
        where: { uuid: entityUuid },
        data: {
          title: String(snapshot.title),
          slug: String(snapshot.slug),
          content: jsonValue(snapshot.content),
          status: 'DRAFT',
          version: { increment: 1 },
          updatedBy: ctx.actorUuid,
        },
      });
      await this.prisma.contentRevision.create({
        data: {
          entityType: 'page',
          entityUuid,
          version: updated.version,
          snapshot: jsonValue(updated),
          changeSummary: `Restored revision ${revision.version}`,
          createdBy: ctx.actorUuid,
        },
      });
      return plain(updated);
    }
    throw new ContentConflictError(
      `Revision restore is unsupported for ${entityType}`,
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
    return row ? plain(row) : null;
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
      const exists = await this.prisma.contentArticleLike.findUnique({
        where: { articleId_userUuid: { articleId: article.id, userUuid } },
      });
      if (exists)
        await this.prisma.contentArticleLike.delete({
          where: { id: exists.id },
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
      return { active: !exists, count };
    }
    const exists = await this.prisma.contentArticleBookmark.findUnique({
      where: { articleId_userUuid: { articleId: article.id, userUuid } },
    });
    if (exists)
      await this.prisma.contentArticleBookmark.delete({
        where: { id: exists.id },
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
    return { active: !exists, count };
  }

  async view(
    articleUuid: string,
    ip: string,
    userAgent = '',
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
    const fingerprint = createHash('sha256')
      .update(`${ip}|${userAgent}|estate-pro-content-view-v1`)
      .digest('hex');
    const now = new Date();
    const day = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    try {
      await this.prisma.contentArticleView.create({
        data: { articleId: article.id, fingerprint, viewedDate: day },
      });
      await this.prisma.contentArticleStatistics.upsert({
        where: { articleId: article.id },
        create: { articleId: article.id, views: 1 },
        update: { views: { increment: 1 } },
      });
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
    return {
      recorded: uniqueViewsToday > 0,
      views: Number(stats.views),
      uniqueViewsToday,
    };
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
    if (userUuid) {
      const recent = await this.prisma.contentComment.findFirst({
        where: {
          articleId: article.id,
          userUuid,
          createdAt: { gte: new Date(Date.now() - 60_000) },
          deletedAt: null,
        },
      });
      if (recent)
        throw new ContentConflictError(
          'Please wait before posting another comment',
        );
    }
    const row = await this.prisma.contentComment.create({
      data: {
        articleId: article.id,
        userUuid,
        authorName:
          typeof input.authorName === 'string' ? input.authorName : null,
        authorEmail:
          typeof input.authorEmail === 'string' ? input.authorEmail : null,
        parentUuid:
          typeof input.parentUuid === 'string' ? input.parentUuid : null,
        content: jsonValue(input.content),
        status: 'PENDING',
      },
    });
    return plain(row);
  }
  async moderate(
    uuid: string,
    status: string,
    reason: string | undefined,
  ): Promise<Record<string, unknown>> {
    const row = await this.prisma.contentComment.update({
      where: { uuid },
      data: {
        status: status as Prisma.ModerationStatus,
        moderationReason: reason ?? null,
        deletedAt: status === 'DELETED' ? new Date() : null,
      },
    });
    return plain(row);
  }
}
