import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { SALES_CONVERSION_PORT } from '../../common/contracts/sales-conversion.port.js';
import { PrismaSalesConversionAdapter } from './sales-conversion.adapter.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: SALES_CONVERSION_PORT,
      useClass: PrismaSalesConversionAdapter,
    },
  ],
  exports: [SALES_CONVERSION_PORT],
})
export class SalesModule {}
