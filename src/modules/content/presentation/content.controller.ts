import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../common/security/authorization.decorators.js';
import {
  ContentConflictError,
  ContentConcurrencyError,
  ContentNotFoundError,
  ContentValidationError,
} from './application/content.errors.js';
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
import {
  ArticleCreateDto,
  ArticleUpdateDto,
  CommentDto,
  ContentQueryDto,
  ModerationDto,
  RelationDto,
  ResourceDto,
} from './presentation/dto/content.dto.js';
import { STORAGE_PROVIDER } from '../../infrastructure/storage/storage-provider.js';
import type { StorageProvider } from '../../infrastructure/storage/storage-provider.js';

type AuthRequest = Request & {
  user?: { sub?: string; permissions?: string[] };
};

@ApiTags('CMS Articles')
@ApiBearerAuth()
@Controller({ path: 'cms', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class ContentController {
  constructor(
    private readonly service: ContentService,
    private readonly createArticle: CreateArticleUseCase,
    private readonly getArticle: GetArticleUseCase,
    private readonly listArticles: ListArticlesUseCase,
    private readonly updateArticle: UpdateArticleUseCase,
    private readonly deleteArticle: DeleteArticleUseCase,
    private readonly restoreArticle: RestoreArticleUseCase,
    private readonly duplicateArticle: DuplicateArticleUseCase,
    private readonly publishArticle: PublishArticleUseCase,
    private readonly unpublishArticle: UnpublishArticleUseCase,
    private readonly archiveArticle: ArchiveArticleUseCase,
    private readonly resources: ContentResourceUseCase,
    private readonly media: MediaUseCase,
    private readonly relations: ContentRelationUseCase,
    private readonly revisions: ListRevisionsUseCase,
    private readonly restoreRevision: RestoreRevisionUseCase,
    private readonly engagement: EngagementUseCase,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  private ctx(req: AuthRequest) {
    return {
      actorUuid: req.user?.sub,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }
  private map(error: unknown): never {
    if (error instanceof ContentNotFoundError)
      throw new NotFoundException(error.message);
    if (
      error instanceof ContentConflictError ||
      error instanceof ContentConcurrencyError
    )
      throw new ConflictException(error.message);
    if (error instanceof ContentValidationError)
      throw new BadRequestException(error.message);
    throw error;
  }
  private permissions(req: AuthRequest) {
    return req.user?.permissions ?? [];
  }

  @Post('articles')
  @RequirePermissions('content.articles.create')
  @ApiOperation({ summary: 'Create article' })
  @ApiResponse({ status: 201 })
  async create(@Req() req: AuthRequest, @Body() dto: ArticleCreateDto) {
    try {
      return await this.createArticle.execute(
        dto as unknown as Record<string, unknown>,
        this.ctx(req),
      );
    } catch (e) {
      this.map(e);
    }
  }
  @Get('articles')
  @RequirePermissions('content.articles.read')
  @ApiOperation({ summary: 'List articles' })
  async list(@Query() q: ContentQueryDto) {
    return this.listArticles.execute(q);
  }
  @Get('articles/:uuid')
  @RequirePermissions('content.articles.read')
  @ApiOperation({ summary: 'Get article' })
  @ApiParam({ name: 'uuid', format: 'uuid' })
  async get(@Req() req: AuthRequest, @Param('uuid') uuid: string) {
    try {
      return await this.getArticle.execute(uuid, false, this.permissions(req));
    } catch (e) {
      this.map(e);
    }
  }
  @Patch('articles/:uuid')
  @RequirePermissions('content.articles.update')
  @ApiOperation({ summary: 'Update article' })
  async update(
    @Req() req: AuthRequest,
    @Param('uuid') uuid: string,
    @Body() dto: ArticleUpdateDto,
  ) {
    try {
      return await this.updateArticle.execute(
        uuid,
        dto as unknown as Record<string, unknown>,
        this.ctx(req),
      );
    } catch (e) {
      this.map(e);
    }
  }
  @Delete('articles/:uuid')
  @RequirePermissions('content.articles.delete')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft delete article' })
  async remove(@Req() req: AuthRequest, @Param('uuid') uuid: string) {
    try {
      await this.deleteArticle.execute(uuid, this.ctx(req));
    } catch (e) {
      this.map(e);
    }
  }
  @Post('articles/:uuid/restore')
  @RequirePermissions('content.articles.restore')
  @ApiOperation({ summary: 'Restore article' })
  async restore(@Req() req: AuthRequest, @Param('uuid') uuid: string) {
    try {
      return await this.restoreArticle.execute(uuid, this.ctx(req));
    } catch (e) {
      this.map(e);
    }
  }
  @Post('articles/:uuid/duplicate')
  @RequirePermissions('content.articles.create')
  @ApiOperation({ summary: 'Duplicate article' })
  async duplicate(@Req() req: AuthRequest, @Param('uuid') uuid: string) {
    try {
      return await this.duplicateArticle.execute(uuid, this.ctx(req));
    } catch (e) {
      this.map(e);
    }
  }
  @Post('articles/:uuid/publish')
  @RequirePermissions('content.articles.publish')
  @ApiOperation({ summary: 'Publish article' })
  async publish(@Req() req: AuthRequest, @Param('uuid') uuid: string) {
    try {
      return await this.publishArticle.execute(uuid, this.ctx(req));
    } catch (e) {
      this.map(e);
    }
  }
  @Post('articles/:uuid/unpublish')
  @RequirePermissions('content.articles.publish')
  @ApiOperation({ summary: 'Unpublish article' })
  async unpublish(@Req() req: AuthRequest, @Param('uuid') uuid: string) {
    try {
      return await this.unpublishArticle.execute(uuid, this.ctx(req));
    } catch (e) {
      this.map(e);
    }
  }
  @Post('articles/:uuid/archive')
  @RequirePermissions('content.articles.archive')
  @ApiOperation({ summary: 'Archive article' })
  async archive(@Req() req: AuthRequest, @Param('uuid') uuid: string) {
    try {
      return await this.archiveArticle.execute(uuid, this.ctx(req));
    } catch (e) {
      this.map(e);
    }
  }
  @Get('articles/:uuid/revisions')
  @RequirePermissions('content.articles.read')
  @ApiOperation({ summary: 'List article revisions' })
  revisionsList(@Param('uuid') uuid: string) {
    return this.revisions.execute('article', uuid);
  }
  @Post('articles/:uuid/revisions/:revisionUuid/restore')
  @RequirePermissions('content.articles.restore')
  @ApiOperation({ summary: 'Restore article revision' })
  async revisionRestore(
    @Req() req: AuthRequest,
    @Param('uuid') uuid: string,
    @Param('revisionUuid') revision: string,
  ) {
    try {
      return await this.restoreRevision.execute(
        'article',
        uuid,
        revision,
        this.ctx(req),
      );
    } catch (e) {
      this.map(e);
    }
  }
  @Put('articles/:uuid/seo')
  @RequirePermissions('content.articles.update')
  @ApiOperation({ summary: 'Upsert article SEO' })
  async seo(
    @Req() req: AuthRequest,
    @Param('uuid') uuid: string,
    @Body() body: Record<string, unknown>,
  ) {
    try {
      return await this.updateArticle.execute(
        uuid,
        { seo: body },
        this.ctx(req),
      );
    } catch (e) {
      this.map(e);
    }
  }

  @Get('media')
  @RequirePermissions('content.media.read')
  @ApiOperation({ summary: 'List media' })
  listMedia(@Query() q: ContentQueryDto) {
    return this.resources.list('media', q);
  }
  @Get('media/:uuid')
  @RequirePermissions('content.media.read')
  @ApiOperation({ summary: 'Get media' })
  getMedia(@Param('uuid') uuid: string) {
    return this.resources.get('media', uuid);
  }
  @Patch('media/:uuid')
  @RequirePermissions('content.media.update')
  @ApiOperation({ summary: 'Update media metadata' })
  updateMedia(
    @Req() req: AuthRequest,
    @Param('uuid') uuid: string,
    @Body() body: ResourceDto,
  ) {
    return this.resources.update(
      'media',
      uuid,
      body as unknown as Record<string, unknown>,
      this.ctx(req),
    );
  }
  @Delete('media/:uuid')
  @RequirePermissions('content.media.delete')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft delete media' })
  async deleteMedia(@Req() req: AuthRequest, @Param('uuid') uuid: string) {
    await this.resources.delete('media', uuid, this.ctx(req));
  }
  @Post('media/:uuid/restore')
  @RequirePermissions('content.media.restore')
  @ApiOperation({ summary: 'Restore media' })
  restoreMedia(@Req() req: AuthRequest, @Param('uuid') uuid: string) {
    return this.resources.restore('media', uuid, this.ctx(req));
  }
  @Post('media/upload')
  @RequirePermissions('content.media.create')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        alt: { type: 'string' },
        caption: { type: 'string' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload media' })
  async uploadMedia(
    @Req() req: AuthRequest,
    @UploadedFile()
    file:
      | { originalname: string; mimetype: string; size: number; buffer: Buffer }
      | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    if (!file) throw new BadRequestException('file is required');
    const key = `media/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    let stored: { key: string; publicUrl: string | null } | undefined;
    try {
      stored = await this.storage.put({
        key,
        content: file.buffer,
        contentType: file.mimetype,
      });
      return await this.media.create(
        file,
        body,
        this.ctx(req),
        stored.key,
        stored.publicUrl,
      );
    } catch (e) {
      if (stored) await this.storage.delete(stored.key).catch(() => undefined);
      this.map(e);
    }
  }

  @Post('relations')
  @RequirePermissions('content.relations.create')
  @ApiOperation({ summary: 'Create content relation' })
  addRelation(@Req() req: AuthRequest, @Body() dto: RelationDto) {
    return this.service.addRelation(
      dto as unknown as Record<string, unknown>,
      this.ctx(req),
    );
  }
  @Get('relations/:sourceUuid')
  @RequirePermissions('content.relations.read')
  @ApiOperation({ summary: 'List content relations' })
  relationList(
    @Param('sourceUuid') uuid: string,
    @Query('relationType') type?: string,
  ) {
    return this.service.listRelations(uuid, type);
  }
  @Delete('relations/:uuid')
  @RequirePermissions('content.relations.delete')
  @HttpCode(204)
  async relationDelete(@Req() req: AuthRequest, @Param('uuid') uuid: string) {
    await this.service.removeRelation(uuid, this.ctx(req));
  }
  @Post('articles/:uuid/likes')
  @RequirePermissions('content.articles.interact')
  async like(@Req() req: AuthRequest, @Param('uuid') uuid: string) {
    if (!req.user?.sub)
      throw new BadRequestException('Authenticated user is required');
    return this.service.toggle('like', uuid, req.user.sub, this.ctx(req));
  }
  @Delete('articles/:uuid/likes')
  @RequirePermissions('content.articles.interact')
  async unlike(@Req() req: AuthRequest, @Param('uuid') uuid: string) {
    if (!req.user?.sub)
      throw new BadRequestException('Authenticated user is required');
    return this.service.toggle('like', uuid, req.user.sub, this.ctx(req));
  }
  @Post('articles/:uuid/bookmark')
  @RequirePermissions('content.articles.interact')
  async bookmark(@Req() req: AuthRequest, @Param('uuid') uuid: string) {
    if (!req.user?.sub)
      throw new BadRequestException('Authenticated user is required');
    return this.service.toggle('bookmark', uuid, req.user.sub, this.ctx(req));
  }
  @Delete('articles/:uuid/bookmark')
  @RequirePermissions('content.articles.interact')
  async unbookmark(@Req() req: AuthRequest, @Param('uuid') uuid: string) {
    if (!req.user?.sub)
      throw new BadRequestException('Authenticated user is required');
    return this.service.toggle('bookmark', uuid, req.user.sub, this.ctx(req));
  }
  @Post('articles/:uuid/comments')
  @RequirePermissions('content.comments.create')
  async comment(
    @Req() req: AuthRequest,
    @Param('uuid') uuid: string,
    @Body() dto: CommentDto,
  ) {
    try {
      return await this.service.comment(
        uuid,
        dto as unknown as Record<string, unknown>,
        this.ctx(req),
      );
    } catch (e) {
      this.map(e);
    }
  }
  @Post('comments/:uuid/moderate')
  @RequirePermissions('content.comments.moderate')
  async moderate(
    @Req() req: AuthRequest,
    @Param('uuid') uuid: string,
    @Body() dto: ModerationDto,
  ) {
    try {
      return await this.service.moderate(
        uuid,
        dto.status,
        dto.reason,
        this.ctx(req),
      );
    } catch (e) {
      this.map(e);
    }
  }
}
