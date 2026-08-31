import { createHash } from 'node:crypto';
import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../../../common/security/authorization.decorators.js';
import { ContentService } from '.../application/content.service.js';
import { ContentNotFoundError } from '.../../application/content.errors.js';

@ApiTags('CMS Public')
@Public()
@Controller({ path: 'content', version: '1' })
export class PublicContentController {
  constructor(private readonly service: ContentService) {}

  @Get('articles/:slug')
  @ApiOperation({ summary: 'Get published public article' })
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 304, description: 'Not modified' })
  async article(
    @Param('slug') slug: string,
    @Headers('accept-language') language: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() response: Response,
  ) {
    try {
      const data = await this.service.public(
        'article',
        slug,
        language?.split(',')[0]?.trim() || 'id',
      );
      const etag = `"${createHash('sha256').update(JSON.stringify(data)).digest('hex')}"`;
      response.setHeader(
        'Cache-Control',
        'public, max-age=60, stale-while-revalidate=300',
      );
      response.setHeader('ETag', etag);
      if (ifNoneMatch === etag) return response.status(304).send();
      return response.status(200).json(data);
    } catch (error) {
      if (error instanceof ContentNotFoundError)
        return response.status(404).json({ message: error.message });
      throw error;
    }
  }

  @Get('pages/:slug')
  @ApiOperation({ summary: 'Get published public page' })
  @ApiParam({ name: 'slug' })
  async page(
    @Param('slug') slug: string,
    @Headers('accept-language') language: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() response: Response,
  ) {
    const data = await this.service.public(
      'page',
      slug,
      language?.split(',')[0]?.trim() || 'id',
    );
    if (!data) return response.status(404).json({ message: 'page not found' });
    const etag = `"${createHash('sha256').update(JSON.stringify(data)).digest('hex')}"`;
    response.setHeader(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=300',
    );
    response.setHeader('ETag', etag);
    if (ifNoneMatch === etag) return response.status(304).send();
    return response.status(200).json(data);
  }

  @Post('articles/:uuid/view')
  @ApiOperation({ summary: 'Record a privacy-preserving article view' })
  async view(@Param('uuid') uuid: string, @Req() request: Request) {
    return this.service.view(uuid, request.ip ?? 'unknown', request.headers['user-agent']);
  }
}
