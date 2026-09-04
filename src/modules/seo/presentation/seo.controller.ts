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
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import type { AccessTokenClaims } from '../../auth/application/services/jwt-token.service.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SeoService } from '../application/seo.service.js';
import {
  CreateRedirectDto,
  UpdateContentSeoDto,
  UpdatePropertySeoDto,
} from '../application/dto/seo.dto.js';

type AuthRequest = Request & { user: AccessTokenClaims };
type SeoResourceType = 'property' | 'listing' | 'article' | 'page';

const seoMetadataResponseSchema = {
  type: 'object',
  properties: {
    resourceType: {
      type: 'string',
      enum: ['property', 'listing', 'article', 'page'],
    },
    uuid: { type: 'string', format: 'uuid' },
    slug: { type: 'string' },
    metadata: {
      type: 'object',
      required: [
        'title',
        'description',
        'canonicalUrl',
        'robots',
        'openGraph',
        'twitter',
        'metadataVersion',
      ],
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        canonicalUrl: { type: 'string', format: 'uri' },
        robots: {
          type: 'string',
          enum: [
            'index,follow',
            'noindex,follow',
            'index,nofollow',
            'noindex,nofollow',
          ],
        },
        openGraph: {
          type: 'object',
          required: ['title', 'description', 'url', 'imageUrl', 'type'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            imageUrl: { type: 'string', format: 'uri', nullable: true },
            type: { type: 'string', enum: ['website', 'article'] },
          },
        },
        twitter: {
          type: 'object',
          required: ['card', 'title', 'description', 'imageUrl'],
          properties: {
            card: { type: 'string', enum: ['summary', 'summary_large_image'] },
            title: { type: 'string' },
            description: { type: 'string' },
            imageUrl: { type: 'string', format: 'uri', nullable: true },
          },
        },
        metadataVersion: { type: 'string' },
      },
    },
  },
  required: ['resourceType', 'uuid', 'slug', 'metadata'],
};

const seoRedirectResponseSchema = {
  type: 'object',
  required: ['uuid', 'sourcePath', 'destination', 'statusCode', 'isActive'],
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    sourcePath: { type: 'string' },
    destination: { type: 'string' },
    statusCode: { type: 'integer', enum: [301, 302] },
    isActive: { type: 'boolean' },
  },
};

const genericObjectResponseSchema = {
  type: 'object',
  additionalProperties: true,
};

@ApiTags('SEO')
@Controller({ path: 'seo', version: '1' })
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Get('public/:resourceType/:identifier')
  @ApiOperation({
    summary: 'Get public SEO metadata for an indexable resource',
  })
  @ApiQuery({ name: 'language', required: false, example: 'id' })
  @ApiOkResponse({
    description: 'Public SEO metadata returned.',
    schema: seoMetadataResponseSchema,
  })
  publicMetadata(
    @Param('resourceType') resourceType: SeoResourceType,
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
  @ApiOkResponse({
    description: 'Public structured data returned.',
    schema: genericObjectResponseSchema,
  })
  publicStructuredData(
    @Param('resourceType') resourceType: SeoResourceType,
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
  @ApiOkResponse({
    description: 'Sitemap index returned.',
    content: {
      'application/xml': { schema: { type: 'string' } },
    },
  })
  async sitemapIndex(@Res() response: Response): Promise<void> {
    response.send(await this.seo.sitemapIndex());
  }

  @Get('sitemap/:part.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @ApiOkResponse({
    description: 'Sitemap XML chunk returned.',
    content: {
      'application/xml': { schema: { type: 'string' } },
    },
  })
  async sitemap(
    @Param('part', ParseIntPipe) part: number,
    @Res() response: Response,
  ): Promise<void> {
    response.send(await this.seo.sitemapChunk(part));
  }

  @Get('robots.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiOkResponse({
    description: 'Robots directives returned.',
    content: {
      'text/plain': { schema: { type: 'string' } },
    },
  })
  robots(@Res() response: Response): void {
    response.send(this.seo.robots());
  }

  @Get('redirect')
  @ApiQuery({ name: 'path', required: true, example: '/articles/old-slug' })
  @ApiOkResponse({
    description: 'Redirect resolved.',
    schema: seoRedirectResponseSchema,
  })
  resolveRedirect(@Query('path') path: string) {
    return this.seo.resolveRedirect(path);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @ApiBearerAuth()
  @Patch('admin/property/:propertyUuid')
  @RequirePermissions('property-seo.update')
  @ApiOkResponse({
    description: 'Property SEO metadata updated.',
    schema: genericObjectResponseSchema,
  })
  updateProperty(
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
  @ApiOkResponse({
    description: 'Article SEO metadata updated.',
    schema: genericObjectResponseSchema,
  })
  updateArticle(
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
  @ApiOkResponse({
    description: 'Page SEO metadata updated.',
    schema: genericObjectResponseSchema,
  })
  updatePage(
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
  @ApiCreatedResponse({
    description: 'Redirect created.',
    schema: seoRedirectResponseSchema,
  })
  createRedirect(@Body() dto: CreateRedirectDto, @Req() request: AuthRequest) {
    return this.seo.createRedirect({ ...dto, actorUuid: request.user.sub });
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @ApiBearerAuth()
  @Delete('admin/redirects/:uuid')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Redirect deactivated.' })
  @RequirePermissions('content.redirects.delete')
  deactivateRedirect(
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Req() request: AuthRequest,
  ) {
    return this.seo.deactivateRedirect(uuid, request.user.sub);
  }
}
