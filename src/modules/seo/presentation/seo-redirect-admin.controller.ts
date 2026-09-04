import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SeoService } from '../application/seo.service.js';

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

const seoRedirectListResponseSchema = {
  type: 'array',
  items: seoRedirectResponseSchema,
};

@ApiTags('SEO Redirect Admin')
@Controller({ path: 'seo/admin/redirects', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
@ApiBearerAuth()
export class SeoRedirectAdminController {
  constructor(private readonly seo: SeoService) {}

  @Get()
  @RequirePermissions('content.redirects.read')
  @ApiOkResponse({
    description: 'SEO redirects returned.',
    schema: seoRedirectListResponseSchema,
  })
  list() {
    return this.seo.listRedirects();
  }
}
