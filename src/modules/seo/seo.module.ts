import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { SeoController } from './presentation/seo.controller.js';
import { SeoService } from './application/seo.service.js';
import { SEO_REPOSITORY } from './domain/repositories/seo.repository.js';
import { PrismaSeoRepository } from './infrastructure/prisma-seo.repository.js';

@Module({
  imports: [DatabaseModule, AuthorizationModule],
  controllers: [SeoController],
  providers: [
    SeoService,
    PrismaSeoRepository,
    { provide: SEO_REPOSITORY, useExisting: PrismaSeoRepository },
  ],
  exports: [SeoService],
})
export class SeoModule {}
