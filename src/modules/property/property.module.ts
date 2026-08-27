import { Module } from '@nestjs/common';
import { AuthorizationGuard } from '../../common/security/authorization.guard.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { PROPERTY_TYPE_REPOSITORY } from './domain/repositories/property-type.repository.js';
import { PrismaPropertyTypeRepository } from './infrastructure/persistence/prisma-property-type.repository.js';
import { CreatePropertyTypeUseCase } from './application/use-cases/create-property-type.use-case.js';
import { DeletePropertyTypeUseCase } from './application/use-cases/delete-property-type.use-case.js';
import { GetPropertyTypeUseCase } from './application/use-cases/get-property-type.use-case.js';
import { ListPropertyTypesUseCase } from './application/use-cases/list-property-types.use-case.js';
import { UpdatePropertyTypeUseCase } from './application/use-cases/update-property-type.use-case.js';
import { PropertyTypesController } from './presentation/property-types.controller.js';
import { PropertyMasterService } from './application/property-master.service.js';
import { PropertyMasterController } from './presentation/property-master.controller.js';
import { PROPERTY_MASTER_REPOSITORY } from './domain/repositories/property-master.repository.js';
import { PrismaPropertyMasterStore } from './infrastructure/persistence/prisma-property-master.store.js';

@Module({
  imports: [DatabaseModule, AuditModule, AuthorizationModule],
  controllers: [PropertyTypesController, PropertyMasterController],
  providers: [
    AuthorizationGuard,
    CreatePropertyTypeUseCase,
    DeletePropertyTypeUseCase,
    GetPropertyTypeUseCase,
    ListPropertyTypesUseCase,
    UpdatePropertyTypeUseCase,
    { provide: PROPERTY_TYPE_REPOSITORY, useClass: PrismaPropertyTypeRepository },
    PropertyMasterService,
    { provide: PROPERTY_MASTER_REPOSITORY, useClass: PrismaPropertyMasterStore },
  ],
  exports: [PROPERTY_TYPE_REPOSITORY, PROPERTY_MASTER_REPOSITORY],
})
export class PropertyModule {}
