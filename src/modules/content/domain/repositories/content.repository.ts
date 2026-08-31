import type {
  AuditContext,
  ContentResourceType,
  PagedResult,
  PaginationQuery,
} from '../content.types.js';

export interface ArticleRecord {
  uuid: string;
  title: string;
  slug: string;
  subtitle: string | null;
  excerpt: string | null;
  content: unknown;
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
  categoryUuid?: string | null;
  category: { uuid: string; name: string; slug: string } | null;
  tags: Array<{ uuid: string; name: string; slug: string }>;
  coverMedia: { uuid: string; url: string | null; alt: string | null } | null;
  version: number;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ContentRepository {
  createArticle(
    input: Record<string, unknown>,
    ctx: AuditContext,
  ): Promise<ArticleRecord>;
  getArticle(
    uuid: string,
    includeDeleted?: boolean,
  ): Promise<ArticleRecord | null>;
  listArticles(
    query: PaginationQuery & {
      categoryUuid?: string;
      tagUuid?: string;
      featured?: boolean;
    },
  ): Promise<PagedResult<ArticleRecord>>;
  updateArticle(
    uuid: string,
    input: Record<string, unknown>,
    expectedVersion?: number,
    ctx?: AuditContext,
  ): Promise<ArticleRecord>;
  softDeleteArticle(uuid: string, ctx: AuditContext): Promise<void>;
  restoreArticle(uuid: string, ctx: AuditContext): Promise<ArticleRecord>;
  transitionArticle(
    uuid: string,
    status: string,
    ctx: AuditContext,
  ): Promise<ArticleRecord>;
  createRevision(
    entityType: ContentResourceType,
    entityUuid: string,
    version: number,
    snapshot: unknown,
    summary: string | undefined,
    ctx: AuditContext,
  ): Promise<void>;
  listRevisions(
    entityType: ContentResourceType,
    entityUuid: string,
  ): Promise<
    Array<{
      uuid: string;
      version: number;
      snapshot: unknown;
      changeSummary: string | null;
      createdBy: string | null;
      createdAt: Date;
    }>
  >;
  restoreRevision(
    entityType: ContentResourceType,
    entityUuid: string,
    revisionUuid: string,
    ctx: AuditContext,
  ): Promise<ArticleRecord | Record<string, unknown>>;
  listResource(
    resource: Exclude<ContentResourceType, 'article'>,
    query: PaginationQuery,
  ): Promise<PagedResult<Record<string, unknown>>>;
  getResource(
    resource: Exclude<ContentResourceType, 'article'>,
    uuid: string,
    includeDeleted?: boolean,
  ): Promise<Record<string, unknown> | null>;
  createResource(
    resource: Exclude<ContentResourceType, 'article'>,
    input: Record<string, unknown>,
    ctx: AuditContext,
  ): Promise<Record<string, unknown>>;
  updateResource(
    resource: Exclude<ContentResourceType, 'article'>,
    uuid: string,
    input: Record<string, unknown>,
    ctx: AuditContext,
  ): Promise<Record<string, unknown>>;
  softDeleteResource(
    resource: Exclude<ContentResourceType, 'article'>,
    uuid: string,
    ctx: AuditContext,
  ): Promise<void>;
  restoreResource(
    resource: Exclude<ContentResourceType, 'article'>,
    uuid: string,
    ctx: AuditContext,
  ): Promise<Record<string, unknown>>;
  getPublic(
    resource: 'article' | 'page',
    slug: string,
    language?: string,
  ): Promise<Record<string, unknown> | null>;
  createMediaObject(
    input: Record<string, unknown>,
    ctx: AuditContext,
  ): Promise<Record<string, unknown>>;
  deleteMediaObject(uuid: string, ctx: AuditContext): Promise<void>;
  toggleInteraction(
    kind: 'like' | 'bookmark',
    articleUuid: string,
    userUuid: string,
    ctx: AuditContext,
  ): Promise<{ active: boolean; count: number }>;
  trackView(
    articleUuid: string,
    fingerprint: string,
  ): Promise<{ recorded: boolean; views: number; uniqueViewsToday: number }>;
  moderateComment(
    uuid: string,
    status: string,
    reason: string | undefined,
    ctx: AuditContext,
  ): Promise<Record<string, unknown>>;
  createComment(
    articleUuid: string,
    input: Record<string, unknown>,
    ctx: AuditContext,
  ): Promise<Record<string, unknown>>;
  addRelation(
    input: Record<string, unknown>,
    ctx: AuditContext,
  ): Promise<Record<string, unknown>>;
  listRelations(
    sourceUuid: string,
    relationType?: string,
  ): Promise<Record<string, unknown>[]>;
  removeRelation(uuid: string, ctx: AuditContext): Promise<void>;
  reorderMenu(
    menuUuid: string,
    orderedItemUuids: string[],
    ctx: AuditContext,
  ): Promise<Record<string, unknown>[]>;
  ensureSlugRedirect(
    resourceType: string,
    oldSlug: string,
    newSlug: string,
    ctx: AuditContext,
  ): Promise<void>;
}

export const CONTENT_REPOSITORY = Symbol('CONTENT_REPOSITORY');
