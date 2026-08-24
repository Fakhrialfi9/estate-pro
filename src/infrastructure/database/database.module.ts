import { Module } from '@nestjs/common';

import { DatabaseHealthService } from './database-health.service.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [DatabaseHealthService],
  exports: [PrismaModule, DatabaseHealthService],
})
export class DatabaseModule {}
