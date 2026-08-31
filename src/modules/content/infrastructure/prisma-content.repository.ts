import { Injectable } from '@nestjs/common';
import type {
  AuditContext,
  ContentResourceType,
  PaginationQuery,
  PagedResult,
} from '../domain/content.types.js';
import type {
  ArticleRecord,
  ContentRepository,
} from '../domain/repositories/content.repository.js';
import { PrismaArticleRepository } from './persistence/prisma-article.repository.js';
import { PrismaContentResourceRepository } from './persistence/prisma-content-resource.repository.js';
import { PrismaContentOperationsRepository } from './persistence/prisma-content-operations.repository.js';

@Injectable()
export class PrismaContentRepository implements ContentRepository {
  constructor(
    private readonly articles: PrismaArticleRepository,
    private readonly resources: PrismaContentResourceRepository,
    private readonly operations: PrismaContentOperationsRepository,
  ) {}

  createArticle(input: Record<string, unknown>, ctx: AuditContext) {
    return this.articles.create(input, ctx);
  }
  getArticle(uuid: string, includeDeleted = false) {
    return this.articles.get(uuid, includeDeleted);
  }
  listArticles(
    query: PaginationQuery & {
      categoryUuid?: string;
      tagUuid?: string;
      featured?: boolean;
    },
  ) {
    return this.articles.list(query);
  }
  updateArticle(
    uuid: string,
    input: Record<string, unknown>,
    expectedVersion?: number,
    ctx?: AuditContext,
  ) {
    return this.articles.update(uuid, input, expectedVersion, ctx ?? {});
  }
  softDeleteArticle(uuid: string, ctx: AuditContext) {
    return this.articles.softDelete(uuid, ctx);
  }
  restoreArticle(uuid: string, ctx: AuditContext) {
    return this.articles.restore(uuid, ctx);
  }
  transitionArticle(uuid: string, status: string, ctx: AuditContext) {
    return this.articles.transition(uuid, status, ctx);
  }
  createRevision(
    type: ContentResourceType,
    uuid: string,
    version: number,
    snapshot: unknown,
    summary: string | undefined,
    ctx: AuditContext,
  ) {
    return this.operations.createRevision(
      type,
      uuid,
      version,
      snapshot,
      summary,
      ctx,
    );
  }
  listRevisions(type: ContentResourceType, uuid: string) {
    return this.operations.listRevisions(type, uuid);
  }
  restoreRevision(
    type: ContentResourceType,
    uuid: string,
    revision: string,
    ctx: AuditContext,
  ) {
    return this.operations.restoreRevision(type, uuid, revision, ctx);
  }
  listResource(
    resource: Exclude<ContentResourceType, 'article'>,
    query: PaginationQuery,
  ): Promise<PagedResult<Record<string, unknown>>> {
    return this.resources.list(resource, query);
  }
  getResource(
    resource: Exclude<ContentResourceType, 'article'>,
    uuid: string,
    includeDeleted = false,
  ) {
    return this.resources.get(resource, uuid, includeDeleted);
  }
  createResource(
    resource: Exclude<ContentResourceType, 'article'>,
    input: Record<string, unknown>,
    ctx: AuditContext,
  ) {
    return this.resources.create(resource, input, ctx);
  }
  updateResource(
    resource: Exclude<ContentResourceType, 'article'>,
    uuid: string,
    input: Record<string, unknown>,
    ctx: AuditContext,
  ) {
    return this.resources.update(resource, uuid, input, ctx);
  }
  softDeleteResource(
    resource: Exclude<ContentResourceType, 'article'>,
    uuid: string,
    ctx: AuditContext,
  ) {
    return this.resources.softDelete(resource, uuid, ctx);
  }
  restoreResource(
    resource: Exclude<ContentResourceType, 'article'>,
    uuid: string,
    ctx: AuditContext,
  ) {
    return this.resources.restore(resource, uuid, ctx);
  }
  async getPublic(resource: 'article' | 'page', slug: string, language = 'id') {
    return resource === 'article'
      ? this.operations.getPublicArticle(slug, language)
      : this.resources.publicItem(resource, slug, language);
  }
  createMediaObject(input: Record<string, unknown>, ctx: AuditContext) {
    return this.resources.createMedia(input);
  }
  deleteMediaObject(uuid: string, ctx: AuditContext) {
    return this.resources.deleteMedia(uuid, ctx);
  }
  toggleInteraction(
    kind: 'like' | 'bookmark',
    articleUuid: string,
    userUuid: string,
    ctx: AuditContext,
  ) {
    return this.operations.toggle(kind, articleUuid, userUuid);
  }
  trackView(articleUuid: string, fingerprint: string) {
    return this.operations.viewHash(articleUuid, fingerprint);
  }
  moderateComment(
    uuid: string,
    status: string,
    reason: string | undefined,
    ctx: AuditContext,
  ) {
    return this.operations.moderate(uuid, status, reason);
  }
  createComment(
    articleUuid: string,
    input: Record<string, unknown>,
    ctx: AuditContext,
  ) {
    return this.operations.comment(articleUuid, input);
  }
  addRelation(input: Record<string, unknown>, ctx: AuditContext) {
    return this.resources.addRelation(input, ctx);
  }
  listRelations(uuid: string, type?: string) {
    return this.resources.relations(uuid, type);
  }
  removeRelation(uuid: string, ctx: AuditContext) {
    return this.resources.deleteRelation(uuid);
  }
  reorderMenu(uuid: string, items: string[], ctx: AuditContext) {
    return this.resources.reorderMenu(uuid, items);
  }
  ensureSlugRedirect(
    type: string,
    oldSlug: string,
    newSlug: string,
    ctx: AuditContext,
  ) {
    return this.resources.ensureRedirect(type, oldSlug, newSlug);
  }
}
