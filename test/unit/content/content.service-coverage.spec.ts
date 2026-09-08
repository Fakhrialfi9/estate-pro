import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ContentService,
  normalizeSlug,
  sanitizeHtml,
  sanitizeJson,
} from '../../../src/modules/content/application/content.service.js';
import type {
  ArticleRecord,
  ContentRepository,
} from '../../../src/modules/content/domain/repositories/content.repository.js';
import {
  ContentConflictError,
  ContentNotFoundError,
  ContentValidationError,
} from '../../../src/modules/content/application/content.errors.js';

const ctx = {
  actorUuid: '11111111-1111-4111-8111-111111111111',
  requestId: 'req-content',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};

const article = (overrides: Partial<ArticleRecord> = {}): ArticleRecord => ({
  uuid: '22222222-2222-4222-8222-222222222222',
  title: 'Article',
  slug: 'article',
  subtitle: 'Subtitle',
  excerpt: 'Excerpt',
  content: { body: 'text' },
  contentFormat: 'RICH_TEXT',
  type: 'ARTICLE',
  status: 'DRAFT',
  visibility: 'PUBLIC',
  language: 'id',
  featured: false,
  allowComments: true,
  wordCount: 2,
  readingTimeMin: 1,
  authorUuid: null,
  category: null,
  tags: [],
  coverMedia: null,
  version: 1,
  scheduledAt: null,
  publishedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

describe('ContentService complete coverage', () => {
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

  const audit = { record: vi.fn() };
  const service = new ContentService(repository, audit);

  beforeEach(() => {
    vi.clearAllMocks();
    repository.getArticle.mockResolvedValue(article());
    repository.updateArticle.mockResolvedValue(article());
    repository.transitionArticle.mockResolvedValue(article({ status: 'PUBLISHED' }));
    repository.restoreArticle.mockResolvedValue(article());
    repository.createArticle.mockResolvedValue(article());
    repository.createResource.mockResolvedValue({ uuid: 'resource-1' });
    repository.updateResource.mockResolvedValue({ uuid: 'resource-1' });
    repository.getResource.mockResolvedValue({ uuid: 'resource-1', version: 2, content: 'x' });
    repository.listResource.mockResolvedValue([]);
    repository.listArticles.mockResolvedValue([]);
    repository.listRevisions.mockResolvedValue([]);
    repository.restoreRevision.mockResolvedValue({ uuid: 'revision-restored' });
    repository.getPublic.mockResolvedValue({ uuid: 'public-1' });
    repository.createMediaObject.mockResolvedValue({ uuid: 'media-1' });
    repository.deleteMediaObject.mockResolvedValue(undefined);
    repository.toggleInteraction.mockResolvedValue({ active: true });
    repository.trackView.mockResolvedValue(undefined);
    repository.moderateComment.mockResolvedValue({ uuid: 'comment-1' });
    repository.createComment.mockResolvedValue({ uuid: 'comment-1' });
    repository.addRelation.mockResolvedValue({ uuid: 'relation-1' });
    repository.listRelations.mockResolvedValue([]);
    repository.removeRelation.mockResolvedValue(undefined);
    repository.reorderMenu.mockResolvedValue(undefined);
    repository.ensureSlugRedirect.mockResolvedValue(undefined);
    repository.softDeleteArticle.mockResolvedValue(undefined);
    repository.softDeleteResource.mockResolvedValue(undefined);
    audit.record.mockResolvedValue(undefined);
  });

  it('covers normalization and sanitization utilities', () => {
    expect(normalizeSlug(' Héllo, World! ')).toBe('hello-world');
    expect(() => normalizeSlug('---')).toThrow(ContentValidationError);
    expect(sanitizeHtml('<script>x</script><p onclick="bad()">safe</p><a href="https://example.com">link</a>')).toBe(
      '<p>safe</p><a href="https://example.com">link</a>',
    );
    expect(sanitizeHtml('<a href="javascript:alert(1)">bad</a>')).toBe('<a>bad</a>');
    expect(sanitizeHtml('<a href="data:text/html,bad">bad</a>')).toBe('<a>bad</a>');
    expect(sanitizeHtml('<!-- comment --><strong>x</strong>')).toBe('<strong>x</strong>');
    expect(sanitizeJson({ html: '<img src=x><p>x</p>', nested: ['<b>x</b>'] })).toEqual({
      html: '<p>x</p>',
      nested: ['x'],
    });
    expect(() => sanitizeJson(Array.from({ length: 501 }, () => 'x'))).toThrow(
      ContentValidationError,
    );
    expect(() => sanitizeJson({ x: 'y' }, 11)).toThrow(ContentValidationError);
  });

  it('covers article CRUD, metadata defaults and validation branches', async () => {
    await service.createArticle(
      {
        title: ' Title ',
        slug: 'Custom Slug',
        content: ['one two'],
        contentFormat: 'BLOCKS',
        type: 'GUIDE',
        visibility: 'PRIVATE',
        language: 'EN',
        featured: true,
        allowComments: false,
        categoryUuid: ctx.actorUuid,
        coverMediaUuid: '33333333-3333-4333-8333-333333333333',
        authorUuid: '44444444-4444-4444-8444-444444444444',
        tagUuids: [ctx.actorUuid, ctx.actorUuid],
        changeSummary: 'changed',
      },
      ctx,
    );
    expect(repository.createArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Title',
        slug: 'custom-slug',
        contentFormat: 'BLOCKS',
        type: 'GUIDE',
        visibility: 'PRIVATE',
        language: 'en',
        featured: true,
        allowComments: false,
        tags: [ctx.actorUuid],
      }),
      ctx,
    );

    await expect(
      service.createArticle({ title: 'x'.repeat(221), content: {} }, ctx),
    ).rejects.toThrow(ContentValidationError);
    await expect(
      service.createArticle(
        { title: 'Title', slug: 'bad!!!', content: {}, featured: 'yes' },
        ctx,
      ),
    ).rejects.toThrow(ContentValidationError);
    await expect(
      service.createArticle(
        { title: 'Title', content: {}, allowComments: 'yes' },
        ctx,
      ),
    ).rejects.toThrow(ContentValidationError);
    await expect(
      service.createArticle(
        { title: 'Title', content: {}, categoryUuid: 'bad' },
        ctx,
      ),
    ).rejects.toThrow(ContentValidationError);
    await expect(
      service.createArticle({ title: 'Title', content: {}, tagUuids: 'bad' }, ctx),
    ).rejects.toThrow(ContentValidationError);
    await expect(
      service.createArticle(
        { title: 'Title', content: {}, tagUuids: [ctx.actorUuid, 'bad'] },
        ctx,
      ),
    ).rejects.toThrow(ContentValidationError);
    await expect(
      service.createArticle({ title: 'Title', content: {}, version: 1 }, ctx),
    ).resolves.toBeDefined();

    repository.getArticle.mockResolvedValueOnce(article({ status: 'ARCHIVED' }));
    const response = await service.getArticle(article().uuid, true, [
      'content.articles.read',
      'content.articles.update',
      'content.articles.delete',
      'content.articles.publish',
      'content.articles.archive',
      'content.articles.restore',
    ]);
    expect(response.permissions.canRestore).toBe(true);
    await expect(service.getArticle('missing')).rejects.toBeInstanceOf(
      ContentNotFoundError,
    );
    await service.listArticles({ page: 2, limit: 5, categoryUuid: ctx.actorUuid, featured: true });
    expect(repository.listArticles).toHaveBeenCalled();

    repository.getArticle.mockResolvedValueOnce(article({ slug: 'old-slug' }));
    repository.updateArticle.mockResolvedValueOnce(article({ slug: 'new-slug' }));
    await service.updateArticle(
      article().uuid,
      {
        title: ' New ',
        slug: ' New Slug ',
        content: '<p>a b</p>',
        tagUuids: [ctx.actorUuid],
        version: 1,
      },
      ctx,
    );
    expect(repository.ensureSlugRedirect).toHaveBeenCalled();

    repository.getArticle.mockResolvedValueOnce(null);
    await expect(service.updateArticle(article().uuid, {}, ctx)).rejects.toBeInstanceOf(
      ContentNotFoundError,
    );
    await expect(
      service.updateArticle(article().uuid, { version: 0 }, ctx),
    ).rejects.toThrow(ContentValidationError);
  });

  it('covers article lifecycle, duplication, deletion, restoration and revision', async () => {
    await service.deleteArticle(article().uuid, ctx);
    await service.restoreArticle(article().uuid, ctx);
    await service.duplicateArticle(article().uuid, ctx);
    await service.revise('article', article().uuid, 'summary', ctx);
    await service.revise('page', article().uuid, undefined, ctx);
    expect(repository.createRevision).toHaveBeenCalledTimes(2);
    expect(await service.revisions('article', article().uuid)).toEqual([]);
    expect(
      await service.restoreRevision('article', article().uuid, 'revision-1', ctx),
    ).toEqual({ uuid: 'revision-restored' });

    repository.getArticle.mockResolvedValueOnce(null);
    await expect(service.duplicateArticle(article().uuid, ctx)).rejects.toBeInstanceOf(
      ContentNotFoundError,
    );
    repository.getArticle.mockResolvedValueOnce(null);
    await expect(service.revise('article', article().uuid, undefined, ctx)).rejects.toBeInstanceOf(
      ContentNotFoundError,
    );

    for (const status of ['APPROVED', 'SCHEDULED', 'DRAFT'] as const) {
      repository.getArticle.mockResolvedValueOnce(article({ status }));
      await service.publish(article().uuid, ctx);
    }
    repository.getArticle.mockResolvedValueOnce(article({ status: 'PUBLISHED' }));
    await service.unpublish(article().uuid, ctx);
    repository.getArticle.mockResolvedValueOnce(article({ status: 'PUBLISHED' }));
    await service.archive(article().uuid, ctx);
    repository.getArticle.mockResolvedValueOnce(article({ status: 'APPROVED' }));
    await service.archive(article().uuid, ctx);
    repository.getArticle.mockResolvedValueOnce(article({ status: 'DRAFT' }));
    await expect(service.unpublish(article().uuid, ctx)).rejects.toBeInstanceOf(
      ContentConflictError,
    );
    repository.getArticle.mockResolvedValueOnce(article({ status: 'DRAFT' }));
    await expect(service.archive(article().uuid, ctx)).rejects.toBeInstanceOf(
      ContentConflictError,
    );
  });

  it('covers generic resources, relations and media', async () => {
    await service.createResource(
      'page',
      { slug: ' About ', content: '<img>x</img><p>safe</p>' },
      ctx,
    );
    await service.updateResource(
      'faq',
      'resource-1',
      { slug: 'FAQ', answer: '<script>x</script>', status: 'PUBLISHED' },
      ctx,
    );
    await service.updateResource(
      'testimonial',
      'resource-1',
      { quote: '<b>Quote</b>', answer: '<p>Answer</p>' },
      ctx,
    );
    await service.deleteResource('page', 'resource-1', ctx);
    await service.restoreResource('page', 'resource-1', ctx);
    await service.getResource('page', 'resource-1', true);
    await service.listResource('page', { page: 1, limit: 10 });
    expect(repository.createResource).toHaveBeenCalled();
    await expect(service.getResource('page', 'missing')).resolves.toBeDefined();

    await service.addRelation(
      { sourceUuid: ctx.actorUuid, targetUuid: '33333333-3333-4333-8333-333333333333', relationType: 'related' },
      ctx,
    );
    await expect(
      service.addRelation(
        { sourceUuid: ctx.actorUuid, targetUuid: ctx.actorUuid },
        ctx,
      ),
    ).rejects.toBeInstanceOf(ContentValidationError);
    await service.listRelations(ctx.actorUuid, 'related');
    await service.listRelations(ctx.actorUuid);
    await service.removeRelation('relation-1', ctx);
    await service.reorderMenu('menu-1', [ctx.actorUuid], ctx);

    const file = {
      originalname: 'photo.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('x'),
    };
    await service.createMedia(
      file,
      { provider: 'local', folder: 'media' },
      ctx,
      'media/key',
      'https://cdn.example.com/media/key',
    );
    expect(repository.createMediaObject).toHaveBeenCalledWith(
      expect.objectContaining({
        originalName: 'photo.png',
        storageKey: 'media/key',
        publicUrl: 'https://cdn.example.com/media/key',
        provider: 'local',
      }),
      ctx,
    );
    await expect(
      service.createMedia({ ...file, mimetype: 'text/plain' }, {}, ctx, 'k', null),
    ).rejects.toThrow(ContentValidationError);
    await expect(
      service.createMedia(
        { ...file, size: 10 * 1024 * 1024 + 1 },
        {},
        ctx,
        'k',
        null,
      ),
    ).rejects.toThrow(ContentValidationError);
    await service.removeMedia('media-1', ctx);
  });

  it('covers engagement, comments, views and public lookups', async () => {
    await service.toggle('like', article().uuid, ctx.actorUuid, ctx);
    await service.interaction('bookmark', article().uuid, ctx.actorUuid, ctx);
    await service.comment(article().uuid, { content: '<script>x</script><p>ok</p>' }, ctx);
    await service.commentCreate(article().uuid, { content: { text: '<img src=x>ok' } }, ctx);
    await service.moderate('comment-1', 'APPROVED', 'reason', ctx);
    await service.commentModerate('comment-1', 'REJECTED', undefined, ctx);
    await service.view(article().uuid, '127.0.0.1');
    await service.view(article().uuid, '127.0.0.1', 'ua');
    await service.public('article', 'Hello World');
    await service.public('page', 'About Us', 'en');
    expect(repository.toggleInteraction).toHaveBeenCalledTimes(2);
    expect(repository.trackView).toHaveBeenCalledTimes(2);
    expect(repository.getPublic).toHaveBeenCalledWith('article', 'hello-world', 'id');
  });

  it('covers private helper branches through public APIs', async () => {
    await service.createArticle(
      {
        title: 'Title',
        content: {},
        visibility: 'PUBLIC',
        contentFormat: 'RICH_TEXT',
        type: 'ARTICLE',
        language: undefined,
        featured: undefined,
        allowComments: undefined,
        tagUuids: undefined,
      },
      ctx,
    );
    await service.createArticle(
      {
        title: 'Title',
        content: {},
        visibility: 'PRIVATE',
        contentFormat: 'MARKDOWN',
        type: 'PRESS_RELEASE',
        language: 'ID',
        featured: false,
        allowComments: true,
        tagUuids: [],
      },
      ctx,
    );
    await service.createArticle(
      {
        title: 'Title',
        content: {},
        visibility: 'OTHER',
        contentFormat: 'OTHER',
        type: 'OTHER',
        language: 'EN',
        featured: false,
        allowComments: true,
      },
      ctx,
    );
    await expect(
      service.createArticle({ title: 'Title', content: {}, language: 10 }, ctx),
    ).rejects.toThrow(ContentValidationError);
    await expect(
      service.createArticle(
        { title: 'Title', content: {}, changeSummary: 'x'.repeat(501) },
        ctx,
      ),
    ).rejects.toThrow(ContentValidationError);
    await expect(
      service.createArticle(
        { title: 'Title', content: {}, tagUuids: [ctx.actorUuid, 'bad'] },
        ctx,
      ),
    ).rejects.toThrow(ContentValidationError);
    await expect(
      service.createArticle(
        { title: 'Title', content: {}, coverMediaUuid: 'not-v4' },
        ctx,
      ),
    ).rejects.toThrow(ContentValidationError);
  });
});
