import { randomUUID } from 'node:crypto';
import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors, HttpCode, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../common/security/authorization.guard.js';
import { RequirePermissions, Public } from '../../common/security/authorization.decorators.js';
import { ContentService, normalizeSlug } from './application/content.service.js';
import { ContentConflictError, ContentConcurrencyError, ContentNotFoundError, ContentValidationError } from './application/content.errors.js';
import { CreateArticleUseCase, GetArticleUseCase, ListArticlesUseCase, UpdateArticleUseCase, DeleteArticleUseCase, RestoreArticleUseCase, DuplicateArticleUseCase, PublishArticleUseCase, UnpublishArticleUseCase, ArchiveArticleUseCase, ContentResourceUseCase, MediaUseCase, ContentRelationUseCase, ListRevisionsUseCase, RestoreRevisionUseCase, EngagementUseCase } from './application/use-cases/content.use-cases.js';
import { ArticleCreateDto, ArticleUpdateDto, ContentQueryDto, ResourceDto, ReorderMenuDto, RelationDto, CommentDto, ModerationDto } from './presentation/dto/content.dto.js';
import { STORAGE_PROVIDER } from '../../infrastructure/storage/storage-provider.js';
import type { StorageProvider } from '../../infrastructure/storage/storage-provider.js';

const RESOURCE_PERMISSIONS: Record<string, string> = { category:'content.categories', tag:'content.tags', page:'content.pages', faq:'content.faqs', testimonial:'content.testimonials', banner:'content.banners', menu:'content.menus', redirect:'content.redirects', media:'content.media', comment:'content.comments' };
type AuthRequest = Request & { user?: { sub?: string; permissions?: string[] } };

@ApiTags('CMS')
@ApiBearerAuth()
@UseInterceptors()
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

  private ctx(req: AuthRequest, ua?: string, requestId?: string) { return { actorUuid: req.user?.sub, ipAddress:req.ip, userAgent:ua, requestId }; }
  private map(error: unknown): never { if(error instanceof ContentNotFoundError) throw new NotFoundException(error.message); if(error instanceof ContentConflictError || error instanceof ContentConcurrencyError) throw new ConflictException(error.message); if(error instanceof ContentValidationError) throw new BadRequestException(error.message); throw error; }
  private permissions(req: AuthRequest) { return req.user?.permissions ?? []; }

  @Post('articles') @RequirePermissions('content.articles.create') @ApiOperation({ summary:'Create article' }) @ApiResponse({status:201})
  async create(@Req() req:AuthRequest,@Body() dto:ArticleCreateDto,@Headers('user-agent') ua?:string,@Headers('x-request-id') requestId?:string){try{return await this.createArticle.execute(dto as unknown as Record<string,unknown>,this.ctx(req,ua,requestId));}catch(e){this.map(e);}}
  @Get('articles') @RequirePermissions('content.articles.read') @ApiOperation({summary:'List articles'})
  async list(@Query() query:ContentQueryDto){return this.listArticles.execute(query);}
  @Get('articles/:uuid') @RequirePermissions('content.articles.read') @ApiOperation({summary:'Get article'}) @ApiParam({name:'uuid',format:'uuid'})
  async get(@Req() req:AuthRequest,@Param('uuid') uuid:string){try{return await this.getArticle.execute(uuid,false,this.permissions(req));}catch(e){this.map(e);}}
  @Patch('articles/:uuid') @RequirePermissions('content.articles.update') @ApiOperation({summary:'Update article'})
  async update(@Req() req:AuthRequest,@Param('uuid') uuid:string,@Body() dto:ArticleUpdateDto,@Headers('user-agent') ua?:string,@Headers('x-request-id') id?:string){try{return await this.updateArticle.execute(uuid,dto as unknown as Record<string,unknown>,this.ctx(req,ua,id));}catch(e){this.map(e);}}
  @Delete('articles/:uuid') @RequirePermissions('content.articles.delete') @HttpCode(204) @ApiOperation({summary:'Soft delete article'})
  async remove(@Req() req:AuthRequest,@Param('uuid') uuid:string,@Headers('user-agent') ua?:string,@Headers('x-request-id') id?:string){try{await this.deleteArticle.execute(uuid,this.ctx(req,ua,id));}catch(e){this.map(e);}}
  @Post('articles/:uuid/restore') @RequirePermissions('content.articles.restore') @ApiOperation({summary:'Restore article'})
  async restore(@Req() req:AuthRequest,@Param('uuid') uuid:string){try{return await this.restoreArticle.execute(uuid,this.ctx(req));}catch(e){this.map(e);}}
  @Post('articles/:uuid/duplicate') @RequirePermissions('content.articles.create') @ApiOperation({summary:'Duplicate article'})
  async duplicate(@Req() req:AuthRequest,@Param('uuid') uuid:string){try{return await this.duplicateArticle.execute(uuid,this.ctx(req));}catch(e){this.map(e);}}
  @Post('articles/:uuid/publish') @RequirePermissions('content.articles.publish') @ApiOperation({summary:'Publish article'})
  async publish(@Req() req:AuthRequest,@Param('uuid') uuid:string){try{return await this.publishArticle.execute(uuid,this.ctx(req));}catch(e){this.map(e);}}
  @Post('articles/:uuid/unpublish') @RequirePermissions('content.articles.publish') @ApiOperation({summary:'Unpublish article'})
  async unpublish(@Req() req:AuthRequest,@Param('uuid') uuid:string){try{return await this.unpublishArticle.execute(uuid,this.ctx(req));}catch(e){this.map(e);}}
  @Post('articles/:uuid/archive') @RequirePermissions('content.articles.archive') @ApiOperation({summary:'Archive article'})
  async archive(@Req() req:AuthRequest,@Param('uuid') uuid:string){try{return await this.archiveArticle.execute(uuid,this.ctx(req));}catch(e){this.map(e);}}

  @Get('articles/:uuid/revisions') @RequirePermissions('content.articles.read') @ApiOperation({summary:'List revisions'})
  revisionsList(@Param('uuid') uuid:string){return this.revisions.execute('article',uuid);}
  @Post('articles/:uuid/revisions/:revisionUuid/restore') @RequirePermissions('content.articles.restore') @ApiOperation({summary:'Restore revision'})
  async revisionRestore(@Req() req:AuthRequest,@Param('uuid') uuid:string,@Param('revisionUuid') revision:string){try{return await this.restoreRevision.execute('article',uuid,revision,this.ctx(req));}catch(e){this.map(e);}}
  @Put('articles/:uuid/seo') @RequirePermissions('content.articles.update') @ApiOperation({summary:'Upsert article SEO'})
  async seo(@Req() req:AuthRequest,@Param('uuid') uuid:string,@Body() body:Record<string,unknown>){try{return await this.updateArticle.execute(uuid,{seo:body},this.ctx(req));}catch(e){this.map(e);}}

  private async resource(resource: 'category'|'tag'|'page'|'faq'|'testimonial'|'banner'|'menu'|'redirect', req:AuthRequest, uuid:string|undefined, body:Record<string,unknown>|undefined, query:ContentQueryDto|undefined, action:'list'|'get'|'create'|'update'|'delete'|'restore'){
    const permission = RESOURCE_PERMISSIONS[resource]; if(action==='list') return this.resources.list(resource,query??{}); if(action==='get') return this.resources.get(resource,uuid!,false); if(action==='create') return this.resources.create(resource,body??{},this.ctx(req)); if(action==='update') return this.resources.update(resource,uuid!,body??{},this.ctx(req)); if(action==='delete') return this.resources.delete(resource,uuid!,this.ctx(req)); return this.resources.restore(resource,uuid!,this.ctx(req));
  }

  @Get(':resource') @RequirePermissions('content.management.read') @ApiOperation({summary:'List CMS resource'})
  async resourceList(@Param('resource') resource:string,@Query() query:ContentQueryDto){if(!(resource in RESOURCE_PERMISSIONS)||resource==='media'||resource==='comment')throw new NotFoundException('CMS resource not found');return this.resources.list(resource as Exclude<keyof typeof RESOURCE_PERMISSIONS,'article'|'media'|'comment'>,query);}
  @Get(':resource/:uuid') @RequirePermissions('content.management.read') @ApiOperation({summary:'Get CMS resource'})
  async resourceGet(@Param('resource') resource:string,@Param('uuid') uuid:string){if(!(resource in RESOURCE_PERMISSIONS)||resource==='media'||resource==='comment')throw new NotFoundException('CMS resource not found');try{return await this.resources.get(resource as Exclude<keyof typeof RESOURCE_PERMISSIONS,'article'|'media'|'comment'>,uuid,false);}catch(e){this.map(e);}}
  @Post(':resource') @RequirePermissions('content.management.create') @ApiOperation({summary:'Create CMS resource'})
  async resourceCreate(@Req() req:AuthRequest,@Param('resource') resource:string,@Body() dto:ResourceDto){if(!(resource in RESOURCE_PERMISSIONS)||resource==='media'||resource==='comment')throw new NotFoundException('CMS resource not found');try{return await this.resources.create(resource as Exclude<keyof typeof RESOURCE_PERMISSIONS,'article'|'media'|'comment'>,dto as unknown as Record<string,unknown>,this.ctx(req));}catch(e){this.map(e);}}
  @Patch(':resource/:uuid') @RequirePermissions('content.management.update') @ApiOperation({summary:'Update CMS resource'})
  async resourceUpdate(@Req() req:AuthRequest,@Param('resource') resource:string,@Param('uuid') uuid:string,@Body() dto:ResourceDto){if(!(resource in RESOURCE_PERMISSIONS)||resource==='media'||resource==='comment')throw new NotFoundException('CMS resource not found');try{return await this.resources.update(resource as Exclude<keyof typeof RESOURCE_PERMISSIONS,'article'|'media'|'comment'>,uuid,dto as unknown as Record<string,unknown>,this.ctx(req));}catch(e){this.map(e);}}
  @Delete(':resource/:uuid') @RequirePermissions('content.management.delete') @HttpCode(204) @ApiOperation({summary:'Delete CMS resource'})
  async resourceDelete(@Req() req:AuthRequest,@Param('resource') resource:string,@Param('uuid') uuid:string){if(!(resource in RESOURCE_PERMISSIONS)||resource==='media'||resource==='comment')throw new NotFoundException('CMS resource not found');try{await this.resources.delete(resource as Exclude<keyof typeof RESOURCE_PERMISSIONS,'article'|'media'|'comment'>,uuid,this.ctx(req));}catch(e){this.map(e);}}
  @Post(':resource/:uuid/restore') @RequirePermissions('content.management.restore') @ApiOperation({summary:'Restore CMS resource'})
  async resourceRestore(@Req() req:AuthRequest,@Param('resource') resource:string,@Param('uuid') uuid:string){if(!(resource in RESOURCE_PERMISSIONS)||resource==='media'||resource==='comment')throw new NotFoundException('CMS resource not found');try{return await this.resources.restore(resource as Exclude<keyof typeof RESOURCE_PERMISSIONS,'article'|'media'|'comment'>,uuid,this.ctx(req));}catch(e){this.map(e);}}

  @Post('media') @RequirePermissions('content.media.create') @UseInterceptors(FileInterceptor('file')) @ApiConsumes('multipart/form-data') @ApiBody({schema:{type:'object',required:['file'],properties:{file:{type:'string',format:'binary'},alt:{type:'string'},caption:{type:'string'}}}}) @ApiOperation({summary:'Upload media'})
  async mediaUpload(@Req() req:AuthRequest,@UploadedFile() file:{originalname:string;mimetype:string;size:number;buffer:Buffer},@Body() body:Record<string,unknown>){if(!file)throw new BadRequestException('file is required');const key=`media/${new Date().toISOString().slice(0,10)}/${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_')}`;let stored;try{stored=await this.storage.put({key,content:file.buffer,contentType:file.mimetype});return await this.media.create(file,body,this.ctx(req),stored.key,stored.publicUrl);}catch(e){if(stored)await this.storage.delete(stored.key).catch(()=>undefined);this.map(e);}}
  @Delete('media/:uuid') @RequirePermissions('content.media.delete') @HttpCode(204) async mediaDelete(@Req() req:AuthRequest,@Param('uuid') uuid:string){try{await this.media.remove(uuid,this.ctx(req));}catch(e){this.map(e);}}

  @Post('menus/:uuid/reorder') @RequirePermissions('content.menus.update') @ApiOperation({summary:'Reorder menu items'})
  async reorder(@Req() req:AuthRequest,@Param('uuid') uuid:string,@Body() dto:ReorderMenuDto){return this.service.reorderMenu(uuid,dto.itemUuids,this.ctx(req));}
  @Post('relations') @RequirePermissions('content.relations.create') async relationCreate(@Req() req:AuthRequest,@Body() dto:RelationDto){return this.service.addRelation(dto as unknown as Record<string,unknown>,this.ctx(req));}
  @Get('relations/:sourceUuid') @RequirePermissions('content.relations.read') async relationList(@Param('sourceUuid') sourceUuid:string,@Query('relationType') type?:string){return this.service.listRelations(sourceUuid,type);}
  @Delete('relations/:uuid') @RequirePermissions('content.relations.delete') @HttpCode(204) async relationDelete(@Req() req:AuthRequest,@Param('uuid') uuid:string){await this.service.removeRelation(uuid,this.ctx(req));}

  @Post('articles/:uuid/likes') @RequirePermissions('content.articles.interact') async like(@Req() req:AuthRequest,@Param('uuid') uuid:string){if(!req.user?.sub)throw new BadRequestException('Authenticated user is required');return this.service.toggle('like',uuid,req.user.sub,this.ctx(req));}
  @Delete('articles/:uuid/likes') @RequirePermissions('content.articles.interact') @HttpCode(200) async unlike(@Req() req:AuthRequest,@Param('uuid') uuid:string){if(!req.user?.sub)throw new BadRequestException('Authenticated user is required');return this.service.toggle('like',uuid,req.user.sub,this.ctx(req));}
  @Post('articles/:uuid/bookmark') @RequirePermissions('content.articles.interact') async bookmark(@Req() req:AuthRequest,@Param('uuid') uuid:string){if(!req.user?.sub)throw new BadRequestException('Authenticated user is required');return this.service.toggle('bookmark',uuid,req.user.sub,this.ctx(req));}
  @Delete('articles/:uuid/bookmark') @RequirePermissions('content.articles.interact') async unbookmark(@Req() req:AuthRequest,@Param('uuid') uuid:string){if(!req.user?.sub)throw new BadRequestException('Authenticated user is required');return this.service.toggle('bookmark',uuid,req.user.sub,this.ctx(req));}
  @Post('articles/:uuid/comments') @RequirePermissions('content.comments.create') async comment(@Req() req:AuthRequest,@Param('uuid') uuid:string,@Body() dto:CommentDto){try{return await this.service.comment(uuid,dto as unknown as Record<string,unknown>,this.ctx(req));}catch(e){this.map(e);}}
  @Post('comments/:uuid/moderate') @RequirePermissions('content.comments.moderate') async moderate(@Req() req:AuthRequest,@Param('uuid') uuid:string,@Body() dto:ModerationDto){try{return await this.service.moderate(uuid,dto.status,dto.reason,this.ctx(req));}catch(e){this.map(e);}}
}
