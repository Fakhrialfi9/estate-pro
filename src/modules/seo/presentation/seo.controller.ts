import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import type { AccessTokenClaims } from '../../auth/application/services/jwt-token.service.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions, Public } from '../../../common/security/authorization.decorators.js';
import { SeoService } from '../application/seo.service.js';
import { CreateRedirectDto, UpdateContentSeoDto, UpdatePropertySeoDto } from '../application/dto/seo.dto.js';

type AuthRequest = Request & { user: AccessTokenClaims };
type SeoResourceType = 'property' | 'listing' | 'article' | 'page';
const genericObjectResponseSchema = { type: 'object', additionalProperties: true };
const seoRedirectResponseSchema = { type: 'object', required: ['uuid', 'sourcePath', 'destination', 'statusCode', 'isActive'], properties: { uuid: { type: 'string', format: 'uuid' }, sourcePath: { type: 'string' }, destination: { type: 'string' }, statusCode: { type: 'integer', enum: [301, 302] }, isActive: { type: 'boolean' } } };

@ApiTags('SEO')
@Controller({ path: 'seo', version: '1' })
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Public()
  @Get('public/:resourceType/:identifier')
  @ApiOperation({ summary: 'Get public SEO metadata for an indexable resource' })
  @ApiQuery({ name: 'language', required: false, example: 'id' })
  @ApiOkResponse({ description: 'Public SEO metadata returned.' })
  publicMetadata(@Param('resourceType') resourceType: SeoResourceType, @Param('identifier') identifier: string, @Query('language') language?: string) {
    return this.seo.getPublicMetadata(resourceType, identifier, language ?? 'id');
  }

  @Public()
  @Get('public/:resourceType/:identifier/structured-data')
  @ApiOperation({ summary: 'Get public JSON-LD projection' })
  @ApiQuery({ name: 'language', required: false, example: 'id' })
  @ApiOkResponse({ description: 'Public structured data returned.', schema: genericObjectResponseSchema })
  publicStructuredData(@Param('resourceType') resourceType: SeoResourceType, @Param('identifier') identifier: string, @Query('language') language?: string) {
    return this.seo.getPublicStructuredData(resourceType, identifier, language ?? 'id');
  }

  @Public()
  @Get('sitemap-index.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @ApiOkResponse({ description: 'Sitemap index returned.', content: { 'application/xml': { schema: { type: 'string' } } } })
  async sitemapIndex(@Res() response: Response): Promise<void> { response.send(await this.seo.sitemapIndex()); }

  @Public()
  @Get('sitemap/:part.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @ApiOkResponse({ description: 'Sitemap XML chunk returned.', content: { 'application/xml': { schema: { type: 'string' } } } })
  async sitemap(@Param('part', ParseIntPipe) part: number, @Res() response: Response): Promise<void> { response.send(await this.seo.sitemapChunk(part)); }

  @Public()
  @Get('robots.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiOkResponse({ description: 'Robots directives returned.', content: { 'text/plain': { schema: { type: 'string' } } } })
  robots(@Res() response: Response): void { response.send(this.seo.robots()); }

  @Public()
  @Get('redirect')
  @ApiQuery({ name: 'path', required: true, example: '/articles/old-slug' })
  @ApiOkResponse({ description: 'Redirect resolved.', schema: seoRedirectResponseSchema })
  resolveRedirect(@Query('path') path: string) { return this.seo.resolveRedirect(path); }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get('admin/redirects')
  @RequirePermissions('content.redirects.read')
  @ApiOkResponse({ description: 'Redirects returned.', schema: { type: 'array', items: seoRedirectResponseSchema } })
  listRedirects() { return this.seo.listRedirects(); }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @ApiBearerAuth()
  @Patch('admin/property/:propertyUuid')
  @RequirePermissions('property-seo.update')
  @ApiOkResponse({ description: 'Property SEO metadata updated.', schema: genericObjectResponseSchema })
  updateProperty(@Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) propertyUuid: string, @Body() dto: UpdatePropertySeoDto, @Req() request: AuthRequest) {
    return this.seo.updatePropertyMetadata(propertyUuid, dto, request.user.sub);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @ApiBearerAuth()
  @Patch('admin/article/:resourceUuid')
  @RequirePermissions('content.articles.update')
  @ApiOkResponse({ description: 'Article SEO metadata updated.', schema: genericObjectResponseSchema })
  updateArticle(@Param('resourceUuid', new ParseUUIDPipe({ version: '4' })) resourceUuid: string, @Body() dto: UpdateContentSeoDto, @Req() request: AuthRequest) {
    return this.seo.updateContentMetadata('article', resourceUuid, dto, request.user.sub);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @ApiBearerAuth()
  @Patch('admin/page/:resourceUuid')
  @RequirePermissions('content.pages.update')
  @ApiOkResponse({ description: 'Page SEO metadata updated.', schema: genericObjectResponseSchema })
  updatePage(@Param('resourceUuid', new ParseUUIDPipe({ version: '4' })) resourceUuid: string, @Body() dto: UpdateContentSeoDto, @Req() request: AuthRequest) {
    return this.seo.updateContentMetadata('page', resourceUuid, dto, request.user.sub);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @ApiBearerAuth()
  @Post('admin/redirects')
  @RequirePermissions('content.redirects.create')
  @ApiCreatedResponse({ description: 'Redirect created.', schema: seoRedirectResponseSchema })
  createRedirect(@Body() dto: CreateRedirectDto, @Req() request: AuthRequest) { return this.seo.createRedirect({ ...dto, actorUuid: request.user.sub }); }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @ApiBearerAuth()
  @Delete('admin/redirects/:uuid')
  @HttpCode(204)
  @RequirePermissions('content.redirects.delete')
  @ApiNoContentResponse({ description: 'Redirect deactivated.' })
  deactivateRedirect(@Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Req() request: AuthRequest) { return this.seo.deactivateRedirect(uuid, request.user.sub); }
}
