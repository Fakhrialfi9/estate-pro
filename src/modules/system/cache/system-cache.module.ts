import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../../common/security/authorization.module.js';
import { AuthenticatedAccessGuard } from '../../../common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { AuditModule } from '../../audit/audit.module.js';
import { SystemCacheOperationsController } from './system-cache-operations.controller.js';
import { InMemorySystemCacheService } from './in-memory-system-cache.service.js';
import { SYSTEM_CACHE } from './system-cache.port.js';

@Module({
  imports: [AuthorizationModule, AuditModule],
  controllers: [SystemCacheOperationsController],
  providers: [
    AuthenticatedAccessGuard,
    AuthorizationGuard,
    InMemorySystemCacheService,
    { provide: SYSTEM_CACHE, useExisting: InMemorySystemCacheService },
  ],
  exports: [SYSTEM_CACHE, InMemorySystemCacheService],
})
export class SystemCacheModule {}
