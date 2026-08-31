import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { PrismaArticleRepository } from './infrastructure/persistence/prisma-article.repository.js';
import { PrismaContentResourceRepository } from './infrastructure/persistence/prisma-content-resource.repository.js';
import { PrismaContentOperationsRepository } from './infrastructure/persistence/prisma-content-operations.repository.js';
import { PrismaContentRepository } from './infrastructure/prisma-content.repository.js';
import { CONTENT_REPOSITORY } from './domain/repositories/content.repository.js';
import { ContentService } from './application/content.service.js';
import {
  CreateArticleUseCase,
  GetArticleUseCase,
  ListArticlesUseCase,
  UpdateArticleUseCase,
  DeleteArticleUseCase,
  RestoreArticleUseCase,
  DuplicateArticleUseCase,
  PublishArticleUseCase,
  UnpublishArticleUseCase,
  ArchiveArticleUseCase,
  ContentResourceUseCase,
  MediaUseCase,
  ContentRelationUseCase,
  ListRevisionsUseCase,
  RestoreRevisionUseCase,
  EngagementUseCase,
} from './application/use-cases/content.use-cases.js';
import { ContentController } from './presentation/content.controller.js';
import { PublicContentController } from './presentation/public-content.controller.js';
import { STORAGE_PROVIDER } from '../../infrastructure/storage/storage-provider.js';
import { LocalStorageProvider } from '../../infrastructure/storage/local-storage.provider.js';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [ContentController, PublicContentController],
  providers: [
    PrismaArticleRepository,
    PrismaContentResourceRepository,
    PrismaContentOperationsRepository,
    PrismaContentRepository,
    { provide: CONTENT_REPOSITORY, useExisting: PrismaContentRepository },
    ContentService,
    CreateArticleUseCase,
    GetArticleUseCase,
    ListArticlesUseCase,
    UpdateArticleUseCase,
    DeleteArticleUseCase,
    RestoreArticleUseCase,
    DuplicateArticleUseCase,
    PublishArticleUseCase,
    UnpublishArticleUseCase,
    ArchiveArticleUseCase,
    ContentResourceUseCase,
    MediaUseCase,
    ContentRelationUseCase,
    ListRevisionsUseCase,
    RestoreRevisionUseCase,
    EngagementUseCase,
    LocalStorageProvider,
    { provide: STORAGE_PROVIDER, useExisting: LocalStorageProvider },
  ],
})
export class ContentModule {}
