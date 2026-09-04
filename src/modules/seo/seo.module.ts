import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { PropertyModule } from '../property/property.module.js';
import { SeoController } from './presentation/seo.controller.js';
import { SeoRedirectAdminController } from './presentation/seo-redirect-admin.controller.js';
import { SeoService } from './application/seo.service.js';
import { SEO_REPOSITORY } from './domain/repositories/seo.repository.js';
import { SITEMAP_QUERY } from './domain/repositories/sitemap.query.js';
import { PrismaSeoRepository } from './infrastructure/prisma-seo.repository.js';
import { PrismaSitemapQuery } from './infrastructure/prisma-sitemap.query.js';

@Module({
  imports: [DatabaseModule, AuthorizationModule, PropertyModule],
  controllers: [SeoController, SeoRedirectAdminController],
  providers: [
    SeoService,
    PrismaSeoRepository,
    PrismaSitemapQuery,
    { provide: SEO_REPOSITORY, useExisting: PrismaSeoRepository },
    { provide: SITEMAP_QUERY, useExisting: PrismaSitemapQuery },
  ],
  exports: [SeoService],
})
export class SeoModule {}
