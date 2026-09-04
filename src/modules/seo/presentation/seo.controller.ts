import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../common/security/authorization.decorators.js';
import { SeoService } from './application/seo.service.js';
import {
  CreateRedirectDto,
  UpdateContentSeoDto,
  UpdatePropertySeoDto,
} from './application/dto/seo.dto.js';
import type { AccessTokenClaims } from '../auth/application/services/jwt-token.service.js';

type AuthRequest = Request & { user: AccessTokenClaims };

@ApiTags('SEO')
@Controller({ path: 'seo', version: '1' })
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Get('public/:resourceType/:identifier')
  @ApiOperation({
    summary: 'Get public SEO metadata for an indexable resource',
  })
  @ApiQuery({ name: 'language', required: false, example: 'id' })
  async publicMetadata(
    @Param('resourceType')
    resourceType: 'property' | 'listing' | 'article' | 'page',
    @Param('identifier') identifier: string,
    @Query('language') language?: string,
  ) {
    return this.seo.getPublicMetadata(
      resourceType,
      identifier,
      language ?? 'id',
    );
  }

  @Get('public/:resourceType/:identifier/structured-data')
  @ApiOperation({ summary: 'Get public JSON-LD projection' })
  @ApiQuery({ name: 'language', required: false, example: 'id' })
  async publicStructuredData(
    @Param('resourceType')
    resourceType: 'property' | 'listing' | 'article' | 'page',
    @Param('identifier') identifier: string,
    @Query('language') language?: string,
  ) {
    return this.seo.getPublicStructuredData(
      resourceType,
      identifier,
      language ?? 'id',
    );
  }

  @Get('sitemap-index.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async sitemapIndex(@Res() response: Response) {
    response.send(await this.seo.sitemapIndex());
  }

  @Get('sitemap/:part.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async sitemap(
    @Param('part', ParseIntPipe) part: number,
    @Res() response: Response,
  ) {
    response.send(await this.seo.sitemapChunk(part));
  }

  @Get('robots.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async robots(@Res() response: Response) {
    response.send(this.seo.robots());
  }

  @Get('redirect')
  @ApiQuery({ name: 'path', required: true, example: '/articles/old-slug' })
  async resolveRedirect(@Query('path') path: string) {
    return this.seo.resolveRedirect(path);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @ApiBearerAuth()
  @Patch('admin/property/:propertyUuid')
  @RequirePermissions('property-seo.update')
  async updateProperty(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
    @Body() dto: UpdatePropertySeoDto,
    @Req() request: AuthRequest,
  ) {
    return this.seo.updatePropertyMetadata(propertyUuid, dto, request.user.sub);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @ApiBearerAuth()
  @Patch('admin/article/:resourceUuid')
  @RequirePermissions('content.articles.update')
  async updateArticle(
    @Param('resourceUuid', new ParseUUIDPipe({ version: '4' }))
    resourceUuid: string,
    @Body() dto: UpdateContentSeoDto,
    @Req() request: AuthRequest,
  ) {
    return this.seo.updateContentMetadata(
      'article',
      resourceUuid,
      dto,
      request.user.sub,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @ApiBearerAuth()
  @Patch('admin/page/:resourceUuid')
  @RequirePermissions('content.pages.update')
  async updatePage(
    @Param('resourceUuid', new ParseUUIDPipe({ version: '4' }))
    resourceUuid: string,
    @Body() dto: UpdateContentSeoDto,
    @Req() request: AuthRequest,
  ) {
    return this.seo.updateContentMetadata(
      'page',
      resourceUuid,
      dto,
      request.user.sub,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @ApiBearerAuth()
  @Post('admin/redirects')
  @RequirePermissions('content.redirects.create')
  async createRedirect(
    @Body() dto: CreateRedirectDto,
    @Req() request: AuthRequest,
  ) {
    return this.seo.createRedirect({ ...dto, actorUuid: request.user.sub });
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @ApiBearerAuth()
  @Delete('admin/redirects/:uuid')
  @HttpCode(204)
  @RequirePermissions('content.redirects.delete')
  async deactivateRedirect(
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Req() request: AuthRequest,
  ) {
    await this.seo.deactivateRedirect(uuid, request.user.sub);
  }
}
