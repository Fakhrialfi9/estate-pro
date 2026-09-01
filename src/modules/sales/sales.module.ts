import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { SALES_REPOSITORY } from './domain/repositories/sales.repository.js';
import { PrismaSalesRepository } from './infrastructure/persistence/prisma-sales.repository.js';
import { SalesService } from './application/sales.service.js';
import { SalesController } from './presentation/sales.controller.js';
import { SALES_CONVERSION_PORT } from '../../common/contracts/sales-conversion.port.js';
import { PrismaSalesConversionAdapter } from './sales-conversion.adapter.js';

@Module({
  imports: [DatabaseModule, AuditModule, AuthorizationModule],
  controllers: [SalesController],
  providers: [
    SalesService,
    PrismaSalesRepository,
    { provide: SALES_REPOSITORY, useExisting: PrismaSalesRepository },
    {
      provide: SALES_CONVERSION_PORT,
      useClass: PrismaSalesConversionAdapter,
    },
  ],
  exports: [SALES_CONVERSION_PORT, SalesService, SALES_REPOSITORY],
})
export class SalesModule {}
