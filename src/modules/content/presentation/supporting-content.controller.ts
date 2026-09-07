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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { ContentResourceUseCase } from '../application/use-cases/content.use-cases.js';
import { ContentService } from '../application/content.service.js';
import { ContentQueryDto, ResourceDto } from './dto/content.dto.js';

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
  @ApiResponse({ status: 200, type: Object })
  listCategories(@Query() q: ContentQueryDto) {
    return this.resources.list('category', q);
  }
  @Get('categories/:uuid')
  @RequirePermissions('content.categories.read')
  @ApiResponse({ status: 200, type: Object })
  getCategory(@Param('uuid') id: string) {
    return this.resources.get('category', id);
  }
  @Post('categories')
  @RequirePermissions('content.categories.create')
  @ApiResponse({ status: 201, type: Object })
  createCategory(@Req() r: AuthRequest, @Body() d: ResourceDto) {
    return this.resources.create(
      'category',
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Patch('categories/:uuid')
  @RequirePermissions('content.categories.update')
  @ApiResponse({ status: 200, type: Object })
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
  @ApiResponse({ status: 204 })
  async deleteCategory(@Req() r: AuthRequest, @Param('uuid') id: string) {
    await this.resources.delete('category', id, this.ctx(r));
  }
  @Post('categories/:uuid/restore')
  @RequirePermissions('content.categories.restore')
  @ApiResponse({ status: 201, type: Object })
  restoreCategory(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.restore('category', id, this.ctx(r));
  }

  @Get('tags') @RequirePermissions('content.tags.read')
  @ApiResponse({ status: 200, type: Object })
  listTags(@Query() q: ContentQueryDto) {
    return this.resources.list('tag', q);
  }
  @Get('tags/:uuid') @RequirePermissions('content.tags.read')
  @ApiResponse({ status: 200, type: Object })
  getTag(@Param('uuid') id: string) {
    return this.resources.get('tag', id);
  }
  @Post('tags') @RequirePermissions('content.tags.create')
  @ApiResponse({ status: 201, type: Object })
  createTag(
    @Req() r: AuthRequest,
    @Body() d: ResourceDto,
  ) {
    return this.resources.create(
      'tag',
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Patch('tags/:uuid') @RequirePermissions('content.tags.update')
  @ApiResponse({ status: 200, type: Object })
  updateTag(
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
  @ApiResponse({ status: 204 })
  async deleteTag(@Req() r: AuthRequest, @Param('uuid') id: string) {
    await this.resources.delete('tag', id, this.ctx(r));
  }
  @Post('tags/:uuid/restore')
  @RequirePermissions('content.tags.restore')
  @ApiResponse({ status: 201, type: Object })
  restoreTag(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.restore('tag', id, this.ctx(r));
  }

  @Get('pages') @RequirePermissions('content.pages.read')
  @ApiResponse({ status: 200, type: Object })
  listPages(@Query() q: ContentQueryDto) {
    return this.resources.list('page', q);
  }
  @Get('pages/:uuid') @RequirePermissions('content.pages.read')
  @ApiResponse({ status: 200, type: Object })
  getPage(@Param('uuid') id: string) {
    return this.resources.get('page', id);
  }
  @Post('pages') @RequirePermissions('content.pages.create')
  @ApiResponse({ status: 201, type: Object })
  createPage(
    @Req() r: AuthRequest,
    @Body() d: ResourceDto,
  ) {
    return this.resources.create(
      'page',
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Patch('pages/:uuid') @RequirePermissions('content.pages.update')
  @ApiResponse({ status: 200, type: Object })
  updatePage(
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
  @ApiResponse({ status: 204 })
  async deletePage(@Req() r: AuthRequest, @Param('uuid') id: string) {
    await this.resources.delete('page', id, this.ctx(r));
  }
  @Post('pages/:uuid/restore')
  @RequirePermissions('content.pages.restore')
  @ApiResponse({ status: 201, type: Object })
  restorePage(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.restore('page', id, this.ctx(r));
  }
  @Post('pages/:uuid/publish')
  @RequirePermissions('content.pages.update')
  @ApiResponse({ status: 201, type: Object })
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
  @ApiResponse({ status: 201, type: Object })
  unpublishPage(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.update('page', id, { status: 'DRAFT' }, this.ctx(r));
  }
  @Post('pages/:uuid/schedule')
  @RequirePermissions('content.pages.update')
  @ApiResponse({ status: 201, type: Object })
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

  @Get('faqs') @RequirePermissions('content.faqs.read')
  @ApiResponse({ status: 200, type: Object })
  listFaqs(@Query() q: ContentQueryDto) {
    return this.resources.list('faq', q);
  }
  @Get('faqs/:uuid') @RequirePermissions('content.faqs.read')
  @ApiResponse({ status: 200, type: Object })
  getFaq(@Param('uuid') id: string) {
    return this.resources.get('faq', id);
  }
  @Post('faqs') @RequirePermissions('content.faqs.create')
  @ApiResponse({ status: 201, type: Object })
  createFaq(
    @Req() r: AuthRequest,
    @Body() d: ResourceDto,
  ) {
    return this.resources.create(
      'faq',
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Patch('faqs/:uuid') @RequirePermissions('content.faqs.update')
  @ApiResponse({ status: 200, type: Object })
  updateFaq(
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
  @ApiResponse({ status: 204 })
  async deleteFaq(@Req() r: AuthRequest, @Param('uuid') id: string) {
    await this.resources.delete('faq', id, this.ctx(r));
  }
  @Post('faqs/:uuid/restore')
  @RequirePermissions('content.faqs.restore')
  @ApiResponse({ status: 201, type: Object })
  restoreFaq(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.restore('faq', id, this.ctx(r));
  }

  @Get('testimonials')
  @RequirePermissions('content.testimonials.read')
  @ApiResponse({ status: 200, type: Object })
  listTestimonials(@Query() q: ContentQueryDto) {
    return this.resources.list('testimonial', q);
  }
  @Get('testimonials/:uuid')
  @RequirePermissions('content.testimonials.read')
  @ApiResponse({ status: 200, type: Object })
  getTestimonial(@Param('uuid') id: string) {
    return this.resources.get('testimonial', id);
  }
  @Post('testimonials')
  @RequirePermissions('content.testimonials.create')
  @ApiResponse({ status: 201, type: Object })
  createTestimonial(@Req() r: AuthRequest, @Body() d: ResourceDto) {
    return this.resources.create(
      'testimonial',
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Patch('testimonials/:uuid')
  @RequirePermissions('content.testimonials.update')
  @ApiResponse({ status: 200, type: Object })
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
  @ApiResponse({ status: 204 })
  async deleteTestimonial(@Req() r: AuthRequest, @Param('uuid') id: string) {
    await this.resources.delete('testimonial', id, this.ctx(r));
  }
  @Post('testimonials/:uuid/restore')
  @RequirePermissions('content.testimonials.restore')
  @ApiResponse({ status: 201, type: Object })
  restoreTestimonial(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.restore('testimonial', id, this.ctx(r));
  }

  @Get('banners') @RequirePermissions('content.banners.read')
  @ApiResponse({ status: 200, type: Object })
  listBanners(@Query() q: ContentQueryDto) {
    return this.resources.list('banner', q);
  }
  @Get('banners/:uuid') @RequirePermissions('content.banners.read')
  @ApiResponse({ status: 200, type: Object })
  getBanner(@Param('uuid') id: string) {
    return this.resources.get('banner', id);
  }
  @Post('banners') @RequirePermissions('content.banners.create')
  @ApiResponse({ status: 201, type: Object })
  createBanner(
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
  @ApiResponse({ status: 200, type: Object })
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
  @ApiResponse({ status: 204 })
  async deleteBanner(@Req() r: AuthRequest, @Param('uuid') id: string) {
    await this.resources.delete('banner', id, this.ctx(r));
  }
  @Post('banners/:uuid/restore')
  @RequirePermissions('content.banners.restore')
  @ApiResponse({ status: 201, type: Object })
  restoreBanner(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.restore('banner', id, this.ctx(r));
  }
  @Post('banners/:uuid/activate')
  @RequirePermissions('content.banners.update')
  @ApiResponse({ status: 201, type: Object })
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
  @ApiResponse({ status: 201, type: Object })
  deactivateBanner(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.update(
      'banner',
      id,
      { status: 'DRAFT' },
      this.ctx(r),
    );
  }

  @Get('menus') @RequirePermissions('content.menus.read')
  @ApiResponse({ status: 200, type: Object })
  listMenus(@Query() q: ContentQueryDto) {
    return this.resources.list('menu', q);
  }
  @Get('menus/:uuid') @RequirePermissions('content.menus.read')
  @ApiResponse({ status: 200, type: Object })
  getMenu(@Param('uuid') id: string) {
    return this.resources.get('menu', id);
  }
  @Post('menus') @RequirePermissions('content.menus.create')
  @ApiResponse({ status: 201, type: Object })
  createMenu(
    @Req() r: AuthRequest,
    @Body() d: ResourceDto,
  ) {
    return this.resources.create(
      'menu',
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Patch('menus/:uuid') @RequirePermissions('content.menus.update')
  @ApiResponse({ status: 200, type: Object })
  updateMenu(
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
  @ApiResponse({ status: 204 })
  async deleteMenu(@Req() r: AuthRequest, @Param('uuid') id: string) {
    await this.resources.delete('menu', id, this.ctx(r));
  }
  @Post('menus/:uuid/restore')
  @RequirePermissions('content.menus.restore')
  @ApiResponse({ status: 201, type: Object })
  restoreMenu(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.restore('menu', id, this.ctx(r));
  }
  @Post('menus/:uuid/reorder')
  @RequirePermissions('content.menus.update')
  @ApiResponse({ status: 201, type: Object })
  reorderMenu(
    @Req() r: AuthRequest,
    @Param('uuid') id: string,
    @Body() d: { itemUuids: string[] },
  ) {
    return this.content.reorderMenu(id, d.itemUuids, this.ctx(r));
  }

  @Get('redirects') @RequirePermissions('content.redirects.read')
  @ApiResponse({ status: 200, type: Object })
  listRedirects(@Query() q: ContentQueryDto) {
    return this.resources.list('redirect', q);
  }
  @Get('redirects/:uuid')
  @RequirePermissions('content.redirects.read')
  @ApiResponse({ status: 200, type: Object })
  getRedirect(@Param('uuid') id: string) {
    return this.resources.get('redirect', id, true);
  }
  @Post('redirects')
  @RequirePermissions('content.redirects.create')
  @ApiResponse({ status: 201, type: Object })
  createRedirect(@Req() r: AuthRequest, @Body() d: ResourceDto) {
    return this.resources.create(
      'redirect',
      d as unknown as Record<string, unknown>,
      this.ctx(r),
    );
  }
  @Patch('redirects/:uuid')
  @RequirePermissions('content.redirects.update')
  @ApiResponse({ status: 200, type: Object })
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
  @ApiResponse({ status: 204 })
  async deleteRedirect(@Req() r: AuthRequest, @Param('uuid') id: string) {
    await this.resources.delete('redirect', id, this.ctx(r));
  }
  @Post('redirects/:uuid/restore')
  @RequirePermissions('content.redirects.restore')
  @ApiResponse({ status: 201, type: Object })
  restoreRedirect(@Req() r: AuthRequest, @Param('uuid') id: string) {
    return this.resources.restore('redirect', id, this.ctx(r));
  }
}
