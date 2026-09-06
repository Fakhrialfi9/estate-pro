import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentService } from '../../../src/modules/content/application/content.service.js';
import type {
  ContentRepository,
  ArticleRecord,
} from '../../../src/modules/content/domain/repositories/content.repository.js';
import {
  ContentConflictError,
  ContentNotFoundError,
  ContentValidationError,
} from '../../../src/modules/content/application/content.errors.js';

const ctx = {
  actorUuid: '11111111-1111-4111-8111-111111111111',
  requestId: 'req-1',
  ipAddress: '127.0.0.1',
  userAgent: 'unit-test',
};
const article = (overrides: Partial<ArticleRecord> = {}): ArticleRecord => ({
  uuid: '22222222-2222-4222-8222-222222222222',
  title: 'Article',
  slug: 'article',
  subtitle: null,
  excerpt: null,
  content: { body: 'text' },
  contentFormat: 'RICH_TEXT',
  type: 'ARTICLE',
  status: 'DRAFT',
  visibility: 'PUBLIC',
  language: 'id',
  featured: false,
  allowComments: true,
  wordCount: 1,
  readingTimeMin: 1,
  authorUuid: null,
  category: null,
  tags: [],
  coverMedia: null,
  version: 1,
  scheduledAt: null,
  publishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('ContentService', () => {
  const repository = {
    createArticle: vi.fn(),
    getArticle: vi.fn(),
    listArticles: vi.fn(),
    updateArticle: vi.fn(),
    softDeleteArticle: vi.fn(),
    restoreArticle: vi.fn(),
    transitionArticle: vi.fn(),
    createRevision: vi.fn(),
    listRevisions: vi.fn(),
    restoreRevision: vi.fn(),
    listResource: vi.fn(),
    getResource: vi.fn(),
    createResource: vi.fn(),
    updateResource: vi.fn(),
    softDeleteResource: vi.fn(),
    restoreResource: vi.fn(),
    getPublic: vi.fn(),
    createMediaObject: vi.fn(),
    deleteMediaObject: vi.fn(),
    toggleInteraction: vi.fn(),
    trackView: vi.fn(),
    moderateComment: vi.fn(),
    createComment: vi.fn(),
    addRelation: vi.fn(),
    listRelations: vi.fn(),
    removeRelation: vi.fn(),
    reorderMenu: vi.fn(),
    ensureSlugRedirect: vi.fn(),
  } satisfies Record<keyof ContentRepository, ReturnType<typeof vi.fn>>;
  const auditRecord = vi.fn().mockResolvedValue(undefined);
  const service = new ContentService(repository, {
    record: auditRecord,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repository.createArticle.mockResolvedValue(article());
    repository.getArticle.mockResolvedValue(article());
    repository.updateArticle.mockResolvedValue(article({ slug: 'new-slug' }));
    repository.transitionArticle.mockResolvedValue(
      article({ status: 'PUBLISHED' }),
    );
    repository.createResource.mockResolvedValue({ uuid: 'resource-1' });
  });

  it('creates a normalized draft and audits the created article', async () => {
    await service.createArticle(
      {
        title: '  Hello World  ',
        content: '<script>x</script><p>one two</p>',
        featured: true,
      },
      ctx,
    );
    expect(repository.createArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Hello World',
        slug: 'hello-world',
        status: 'DRAFT',
        featured: true,
        wordCount: 3,
        readingTimeMin: 1,
        content: 'x<p>one two</p>',
      }),
      ctx,
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'content.article.created',
        entityUuid: article().uuid,
        actorUuid: ctx.actorUuid,
      }),
    );
  });

  it('rejects invalid article input before persistence', async () => {
    await expect(
      service.createArticle({ title: '  ', content: {} }, ctx),
    ).rejects.toBeInstanceOf(ContentValidationError);
    expect(repository.createArticle).not.toHaveBeenCalled();
  });

  it('updates an article and creates a redirect when its slug changes', async () => {
    await service.updateArticle(
      article().uuid,
      { slug: ' New Slug ', content: ['one two'], version: 1 },
      ctx,
    );
    expect(repository.updateArticle).toHaveBeenCalledWith(
      article().uuid,
      expect.objectContaining({ slug: 'new-slug', version: 1, wordCount: 2 }),
      1,
      ctx,
    );
    expect(repository.ensureSlugRedirect).toHaveBeenCalledWith(
      'article',
      'article',
      'new-slug',
      ctx,
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'content.article.updated' }),
    );
  });

  it('rejects missing articles and invalid publish transitions', async () => {
    repository.getArticle.mockResolvedValueOnce(null);
    await expect(service.getArticle('missing')).rejects.toBeInstanceOf(
      ContentNotFoundError,
    );
    repository.getArticle.mockResolvedValueOnce(
      article({ status: 'ARCHIVED' }),
    );
    await expect(service.publish(article().uuid, ctx)).rejects.toBeInstanceOf(
      ContentConflictError,
    );
    expect(repository.transitionArticle).not.toHaveBeenCalled();
  });

  it('publishes valid articles and audits the transition', async () => {
    await service.publish(article().uuid, ctx);
    expect(repository.transitionArticle).toHaveBeenCalledWith(
      article().uuid,
      'PUBLISHED',
      ctx,
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'content.article.published' }),
    );
  });

  it('sanitizes resource content and rejects self-relations', async () => {
    await service.createResource(
      'page',
      { slug: ' About Us ', content: '<img src=x><p>Safe</p>' },
      ctx,
    );
    expect(repository.createResource).toHaveBeenCalledWith(
      'page',
      { slug: 'about-us', content: '<p>Safe</p>' },
      ctx,
    );
    await expect(
      service.addRelation({ sourceUuid: 'same', targetUuid: 'same' }, ctx),
    ).rejects.toBeInstanceOf(ContentValidationError);
  });
});
