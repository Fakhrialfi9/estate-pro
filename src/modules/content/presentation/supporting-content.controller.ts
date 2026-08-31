import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../../common/security/authorization.decorators.js';
import { ContentResourceUseCase } from '.../application/use-cases/content.use-cases.js';
import { ContentService } from '.../application/content.service.js';
import {
  ContentQueryDto,
  ResourceDto,
} from './dto/content.dto.js';

type AuthRequest = Request & { user?: { sub?: string } };
type Resource =
  | 'category'
  | 'tag'
  | 'page'
  | 'faq'
  | 'testimonial'
  | 'banner'
  | 'menu'
  | 'redirect';

@ApiTags('CMS Resources')
@ApiBearerAuth()
@Controller({ path: 'cms', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class SupportingContentController {
  constructor(
    private readonly resources: ContentResourceUseCase,
    private readonly content: ContentService,
  ) {}

  private ctx(req: AuthRequest) {
    return {
      actorUuid: req.user?.sub,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }
  private resource(value: string): Resource {
    if (
      ![
        'category',
        'tag',
        'page',
        'faq',
        'testimonial',
        'banner',
        'menu',
        'redirect',
      ].includes(value)
    )
      throw new NotFoundException('CMS resource not found');
    return value as Resource;
  }

  @Get('categories')
  @RequirePermissions('content.categories.read')
  @ApiOperation({ summary: 'List article categories' })
  listCategories(@Query() q: ContentQueryDto) {
    return this.resources.list('category', q);
  }
  @Get('categories/:uuid')
  @RequirePermissions('content.categories.read')
  getCategory(@Param('uuid') id: string) {
    return this.resources.get('category', id);
  }
  @Post('categories')
  @RequirePermissions('content.categories.create')
  createCategory(@Req() r: AuthRequest, @Body() d: ResourceDto) {
    return this.resources.create(
      'category',
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Patch('categories/:uuid')
  @RequirePermissions('content.categories.update')
  updateCategory(
    @Req() r: AuthRequest,
    @Param('uuid') id: string,
    @Body() d: ResourceDto,
  ) {
    return this.resources.update(
      'category',
      id,
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Delete('categories/:uuid')
  @RequirePermissions('content.categories.delete')
  @HttpCode(204)
  async deleteCategory(@Req() r: AuthRequest, @Param('uuid') id: string) {
    await this.resources.delete('category', id, this.ctx(r));
  }
  @Post('categories/:uuid/restore')
  @RequirePermissions('content.categories.restore')
  restoreCategory(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.restore('category', id, this.ctx(r));
  }

  @Get('tags') @RequirePermissions('content.tags.read') listTags(
    @Query() q: ContentQueryDto,
  ) {
    return this.resources.list('tag', q);
  }
  @Get('tags/:uuid') @RequirePermissions('content.tags.read') getTag(
    @Param('uuid') id: string,
  ) {
    return this.resources.get('tag', id);
  }
  @Post('tags') @RequirePermissions('content.tags.create') createTag(
    @Req() r: AuthRequest,
    @Body() d: ResourceDto,
  ) {
    return this.resources.create(
      'tag',
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Patch('tags/:uuid') @RequirePermissions('content.tags.update') updateTag(
    @Req() r: AuthRequest,
    @Param('uuid') id: string,
    @Body() d: ResourceDto,
  ) {
    return this.resources.update(
      'tag',
      id,
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Delete('tags/:uuid')
  @RequirePermissions('content.tags.delete')
  @HttpCode(204)
  async deleteTag(@Req() r: AuthRequest, @Param('uuid') id: string) {
    await this.resources.delete('tag', id, this.ctx(r));
  }
  @Post('tags/:uuid/restore')
  @RequirePermissions('content.tags.restore')
  restoreTag(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.restore('tag', id, this.ctx(r));
  }

  @Get('pages') @RequirePermissions('content.pages.read') listPages(
    @Query() q: ContentQueryDto,
  ) {
    return this.resources.list('page', q);
  }
  @Get('pages/:uuid') @RequirePermissions('content.pages.read') getPage(
    @Param('uuid') id: string,
  ) {
    return this.resources.get('page', id);
  }
  @Post('pages') @RequirePermissions('content.pages.create') createPage(
    @Req() r: AuthRequest,
    @Body() d: ResourceDto,
  ) {
    return this.resources.create(
      'page',
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Patch('pages/:uuid') @RequirePermissions('content.pages.update') updatePage(
    @Req() r: AuthRequest,
    @Param('uuid') id: string,
    @Body() d: ResourceDto,
  ) {
    return this.resources.update(
      'page',
      id,
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Delete('pages/:uuid')
  @RequirePermissions('content.pages.delete')
  @HttpCode(204)
  async deletePage(@Req() r: AuthRequest, @Param('uuid') id: string) {
    await this.resources.delete('page', id, this.ctx(r));
  }
  @Post('pages/:uuid/restore')
  @RequirePermissions('content.pages.restore')
  restorePage(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.restore('page', id, this.ctx(r));
  }
  @Post('pages/:uuid/publish')
  @RequirePermissions('content.pages.update')
  publishPage(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.update(
      'page',
      id,
      { status: 'PUBLISHED' },
      this.ctx(r),
    );
  }
  @Post('pages/:uuid/unpublish')
  @RequirePermissions('content.pages.update')
  unpublishPage(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.update('page', id, { status: 'DRAFT' }, this.ctx(r));
  }
  @Post('pages/:uuid/schedule')
  @RequirePermissions('content.pages.update')
  schedulePage(
    @Req() r: AuthRequest,
    @Param('uuid') id: string,
    @Body() d: ResourceDto,
  ) {
    return this.resources.update(
      'page',
      id,
      { ...d, status: 'SCHEDULED' },
      this.ctx(r),
    );
  }

  @Get('faqs') @RequirePermissions('content.faqs.read') listFaqs(
    @Query() q: ContentQueryDto,
  ) {
    return this.resources.list('faq', q);
  }
  @Get('faqs/:uuid') @RequirePermissions('content.faqs.read') getFaq(
    @Param('uuid') id: string,
  ) {
    return this.resources.get('faq', id);
  }
  @Post('faqs') @RequirePermissions('content.faqs.create') createFaq(
    @Req() r: AuthRequest,
    @Body() d: ResourceDto,
  ) {
    return this.resources.create(
      'faq',
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Patch('faqs/:uuid') @RequirePermissions('content.faqs.update') updateFaq(
    @Req() r: AuthRequest,
    @Param('uuid') id: string,
    @Body() d: ResourceDto,
  ) {
    return this.resources.update(
      'faq',
      id,
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Delete('faqs/:uuid')
  @RequirePermissions('content.faqs.delete')
  @HttpCode(204)
  async deleteFaq(@Req() r: AuthRequest, @Param('uuid') id: string) {
    await this.resources.delete('faq', id, this.ctx(r));
  }
  @Post('faqs/:uuid/restore')
  @RequirePermissions('content.faqs.restore')
  restoreFaq(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.restore('faq', id, this.ctx(r));
  }

  @Get('testimonials')
  @RequirePermissions('content.testimonials.read')
  listTestimonials(@Query() q: ContentQueryDto) {
    return this.resources.list('testimonial', q);
  }
  @Get('testimonials/:uuid')
  @RequirePermissions('content.testimonials.read')
  getTestimonial(@Param('uuid') id: string) {
    return this.resources.get('testimonial', id);
  }
  @Post('testimonials')
  @RequirePermissions('content.testimonials.create')
  createTestimonial(@Req() r: AuthRequest, @Body() d: ResourceDto) {
    return this.resources.create(
      'testimonial',
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Patch('testimonials/:uuid')
  @RequirePermissions('content.testimonials.update')
  updateTestimonial(
    @Req() r: AuthRequest,
    @Param('uuid') id: string,
    @Body() d: ResourceDto,
  ) {
    return this.resources.update(
      'testimonial',
      id,
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Delete('testimonials/:uuid')
  @RequirePermissions('content.testimonials.delete')
  @HttpCode(204)
  async deleteTestimonial(@Req() r: AuthRequest, @Param('uuid') id: string) {
    await this.resources.delete('testimonial', id, this.ctx(r));
  }
  @Post('testimonials/:uuid/restore')
  @RequirePermissions('content.testimonials.restore')
  restoreTestimonial(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.restore('testimonial', id, this.ctx(r));
  }

  @Get('banners') @RequirePermissions('content.banners.read') listBanners(
    @Query() q: ContentQueryDto,
  ) {
    return this.resources.list('banner', q);
  }
  @Get('banners/:uuid') @RequirePermissions('content.banners.read') getBanner(
    @Param('uuid') id: string,
  ) {
    return this.resources.get('banner', id);
  }
  @Post('banners') @RequirePermissions('content.banners.create') createBanner(
    @Req() r: AuthRequest,
    @Body() d: ResourceDto,
  ) {
    return this.resources.create(
      'banner',
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Patch('banners/:uuid')
  @RequirePermissions('content.banners.update')
  updateBanner(
    @Req() r: AuthRequest,
    @Param('uuid') id: string,
    @Body() d: ResourceDto,
  ) {
    return this.resources.update(
      'banner',
      id,
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Delete('banners/:uuid')
  @RequirePermissions('content.banners.delete')
  @HttpCode(204)
  async deleteBanner(@Req() r: AuthRequest, @Param('uuid') id: string) {
    await this.resources.delete('banner', id, this.ctx(r));
  }
  @Post('banners/:uuid/restore')
  @RequirePermissions('content.banners.restore')
  restoreBanner(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.restore('banner', id, this.ctx(r));
  }
  @Post('banners/:uuid/activate')
  @RequirePermissions('content.banners.update')
  activateBanner(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.update(
      'banner',
      id,
      { status: 'PUBLISHED' },
      this.ctx(r),
    );
  }
  @Post('banners/:uuid/deactivate')
  @RequirePermissions('content.banners.update')
  deactivateBanner(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.update(
      'banner',
      id,
      { status: 'DRAFT' },
      this.ctx(r),
    );
  }

  @Get('menus') @RequirePermissions('content.menus.read') listMenus(
    @Query() q: ContentQueryDto,
  ) {
    return this.resources.list('menu', q);
  }
  @Get('menus/:uuid') @RequirePermissions('content.menus.read') getMenu(
    @Param('uuid') id: string,
  ) {
    return this.resources.get('menu', id);
  }
  @Post('menus') @RequirePermissions('content.menus.create') createMenu(
    @Req() r: AuthRequest,
    @Body() d: ResourceDto,
  ) {
    return this.resources.create(
      'menu',
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Patch('menus/:uuid') @RequirePermissions('content.menus.update') updateMenu(
    @Req() r: AuthRequest,
    @Param('uuid') id: string,
    @Body() d: ResourceDto,
  ) {
    return this.resources.update(
      'menu',
      id,
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Delete('menus/:uuid')
  @RequirePermissions('content.menus.delete')
  @HttpCode(204)
  async deleteMenu(@Req() r: AuthRequest, @Param('uuid') id: string) {
    await this.resources.delete('menu', id, this.ctx(r));
  }
  @Post('menus/:uuid/restore')
  @RequirePermissions('content.menus.restore')
  restoreMenu(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.restore('menu', id, this.ctx(r));
  }
  @Post('menus/:uuid/reorder')
  @RequirePermissions('content.menus.update')
  reorderMenu(
    @Req() r: AuthRequest,
    @Param('uuid') id: string,
    @Body() d: { itemUuids: string[] },
  ) {
    return this.content.reorderMenu(id, d.itemUuids, this.ctx(r));
  }

  @Get('redirects') @RequirePermissions('content.redirects.read') listRedirects(
    @Query() q: ContentQueryDto,
  ) {
    return this.resources.list('redirect', q);
  }
  @Get('redirects/:uuid')
  @RequirePermissions('content.redirects.read')
  getRedirect(@Param('uuid') id: string) {
    return this.resources.get('redirect', id, true);
  }
  @Post('redirects')
  @RequirePermissions('content.redirects.create')
  createRedirect(@Req() r: AuthRequest, @Body() d: ResourceDto) {
    return this.resources.create(
      'redirect',
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Patch('redirects/:uuid')
  @RequirePermissions('content.redirects.update')
  updateRedirect(
    @Req() r: AuthRequest,
    @Param('uuid') id: string,
    @Body() d: ResourceDto,
  ) {
    return this.resources.update(
      'redirect',
      id,
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Delete('redirects/:uuid')
  @RequirePermissions('content.redirects.delete')
  @HttpCode(204)
  async deleteRedirect(@Req() r: AuthRequest, @Param('uuid') id: string) {
    await this.resources.delete('redirect', id, this.ctx(r));
  }
  @Post('redirects/:uuid/restore')
  @RequirePermissions('content.redirects.restore')
  restoreRedirect(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.restore('redirect', id, this.ctx(r));
  }
}
