import { describe, expect, it, vi } from 'vitest';
import {
  ArchiveArticleUseCase,
  ContentRelationUseCase,
  ContentResourceUseCase,
  CreateArticleUseCase,
  DeleteArticleUseCase,
  DuplicateArticleUseCase,
  EngagementUseCase,
  GetArticleUseCase,
  ListArticlesUseCase,
  ListRevisionsUseCase,
  MediaUseCase,
  PublishArticleUseCase,
  RestoreArticleUseCase,
  RestoreRevisionUseCase,
  UnpublishArticleUseCase,
  UpdateArticleUseCase,
} from '../../../src/modules/content/application/use-cases/content.use-cases.js';
import type { AuditContext } from '../../../src/modules/content/domain/content.types.js';

const ctx: AuditContext = { actorUuid: '11111111-1111-4111-8111-111111111111' };
const service = {
  createArticle: vi.fn(),
  getArticle: vi.fn(),
  listArticles: vi.fn(),
  updateArticle: vi.fn(),
  deleteArticle: vi.fn(),
  restoreArticle: vi.fn(),
  duplicateArticle: vi.fn(),
  transitionArticle: vi.fn(),
  revisions: vi.fn(),
  restoreRevision: vi.fn(),
  listResource: vi.fn(),
  getResource: vi.fn(),
  createResource: vi.fn(),
  updateResource: vi.fn(),
  deleteResource: vi.fn(),
  restoreResource: vi.fn(),
  createMedia: vi.fn(),
  removeMedia: vi.fn(),
  interaction: vi.fn(),
  view: vi.fn(),
  commentCreate: vi.fn(),
  commentModerate: vi.fn(),
};
const repository = {
  addRelation: vi.fn(),
  listRelations: vi.fn(),
  removeRelation: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(service).forEach((mock) => mock.mockResolvedValue({ ok: true }));
  Object.values(repository).forEach((mock) => mock.mockResolvedValue({ ok: true }));
});

describe('content use cases coverage', () => {
  it('delegates article use cases', async () => {
    await new CreateArticleUseCase(service).execute({}, ctx);
    await new GetArticleUseCase(service).execute('a');
    await new ListArticlesUseCase(service).execute({ page: 1, limit: 10 });
    await new UpdateArticleUseCase(service).execute('a', {}, ctx);
    await new DeleteArticleUseCase(service).execute('a', ctx);
    await new RestoreArticleUseCase(service).execute('a', ctx);
    await new DuplicateArticleUseCase(service).execute('a', ctx);
    await new PublishArticleUseCase(service).execute('a', ctx);
    await new UnpublishArticleUseCase(service).execute('a', ctx);
    await new ArchiveArticleUseCase(service).execute('a', ctx);
    expect(service.createArticle).toHaveBeenCalled();
    expect(service.getArticle).toHaveBeenCalled();
    expect(service.listArticles).toHaveBeenCalled();
    expect(service.updateArticle).toHaveBeenCalled();
    expect(service.deleteArticle).toHaveBeenCalled();
    expect(service.restoreArticle).toHaveBeenCalled();
    expect(service.duplicateArticle).toHaveBeenCalled();
    expect(service.transitionArticle).toHaveBeenCalledTimes(3);
  });

  it('delegates revisions, generic resources and relations', async () => {
    await new ListRevisionsUseCase(service).execute('article', 'a');
    await new RestoreRevisionUseCase(service).execute('article', 'a', 'r', ctx);
    const resources = new ContentResourceUseCase(service);
    await resources.list('page', { page: 1, limit: 10 });
    await resources.get('page', 'p');
    await resources.create('page', {}, ctx);
    await resources.update('page', 'p', {}, ctx);
    await resources.delete('page', 'p', ctx);
    await resources.restore('page', 'p', ctx);
    const relations = new ContentRelationUseCase(repository);
    await relations.add({}, ctx);
    await relations.list('p', 'related');
    await relations.remove('r', ctx);
    expect(service.revisions).toHaveBeenCalled();
    expect(service.restoreRevision).toHaveBeenCalled();
    expect(repository.addRelation).toHaveBeenCalled();
  });

  it('delegates media and engagement use cases', async () => {
    const media = new MediaUseCase(service);
    await media.create(
      { originalname: 'a.png', mimetype: 'image/png', size: 1, buffer: Buffer.from('x') },
      {},
      ctx,
      'key',
      null,
    );
    await media.remove('m', ctx);
    const engagement = new EngagementUseCase(service);
    await engagement.toggle('like', 'a', ctx.actorUuid, ctx);
    await engagement.view('a', '127.0.0.1', 'ua');
    await engagement.comment('a', {}, ctx);
    await engagement.moderate('c', 'APPROVED', undefined, ctx);
    expect(service.createMedia).toHaveBeenCalled();
    expect(service.removeMedia).toHaveBeenCalled();
    expect(service.interaction).toHaveBeenCalled();
    expect(service.view).toHaveBeenCalled();
    expect(service.commentCreate).toHaveBeenCalled();
    expect(service.commentModerate).toHaveBeenCalled();
  });
});
