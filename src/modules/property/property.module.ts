import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthorizationGuard } from '../../common/security/authorization.guard.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { ListingModule } from './listing/listing.module.js';
import { PROPERTY_TYPE_REPOSITORY } from './domain/repositories/property-type.repository.js';
import { PrismaPropertyTypeRepository } from './infrastructure/persistence/prisma-property-type.repository.js';
import { CreatePropertyTypeUseCase } from './application/use-cases/create-property-type.use-case.js';
import { DeletePropertyTypeUseCase } from './application/use-cases/delete-property-type.use-case.js';
import { GetPropertyTypeUseCase } from './application/use-cases/get-property-type.use-case.js';
import { ListPropertyTypesUseCase } from './application/use-cases/list-property-types.use-case.js';
import { UpdatePropertyTypeUseCase } from './application/use-cases/update-property-type.use-case.js';
import { PropertyTypesController } from './presentation/property-types.controller.js';
import { PropertyMasterService } from './application/property-master.service.js';
import { PropertyDetailsService } from './application/property-details.service.js';
import { PropertyExtrasService } from './application/property-extras.service.js';
import { PropertyLifecycleService } from './application/property-lifecycle.service.js';
import { PropertyController } from './presentation/controllers/property.controller.js';
import { PropertyCategoryController } from './presentation/controllers/property-category.controller.js';
import { PropertySubcategoryController } from './presentation/controllers/property-subcategory.controller.js';
import { PropertyLocationController } from './presentation/controllers/property-location.controller.js';
import { PropertyFacilityController } from './presentation/controllers/property-facility.controller.js';
import { PropertyDetailsController } from './presentation/property-details.controller.js';
import { PropertyExtrasController } from './presentation/property-extras.controller.js';
import { PropertyLifecycleController } from './presentation/property-lifecycle.controller.js';
import { PROPERTY_MASTER_REPOSITORY } from './domain/repositories/property-master.repository.js';
import { PrismaPropertyMasterStore } from './infrastructure/persistence/prisma-property-master.store.js';
import { PROPERTY_DETAILS_REPOSITORY } from './domain/repositories/property-details.repository.js';
import { PrismaPropertyDetailsRepository } from './infrastructure/persistence/prisma-property-details.repository.js';
import { PROPERTY_EXTRAS_REPOSITORY } from './domain/repositories/property-extras.repository.js';
import { PrismaPropertyExtrasRepository } from './infrastructure/persistence/prisma-property-extras.repository.js';
import { PROPERTY_LIFECYCLE_REPOSITORY } from './domain/repositories/property-lifecycle.repository.js';
import { PrismaPropertyLifecycleRepository } from './infrastructure/persistence/prisma-property-lifecycle.repository.js';
import { PropertyMetricsInterceptor } from './observability/property-metrics.interceptor.js';

@Module({
  imports: [DatabaseModule, AuditModule, AuthorizationModule, ListingModule],
  controllers: [PropertyTypesController, PropertyController, PropertyCategoryController, PropertySubcategoryController, PropertyLocationController, PropertyFacilityController, PropertyDetailsController, PropertyExtrasController, PropertyLifecycleController],
  providers: [
    AuthorizationGuard, CreatePropertyTypeUseCase, DeletePropertyTypeUseCase, GetPropertyTypeUseCase, ListPropertyTypesUseCase, UpdatePropertyTypeUseCase,
    { provide: PROPERTY_TYPE_REPOSITORY, useClass: PrismaPropertyTypeRepository },
    PropertyMasterService, { provide: PROPERTY_MASTER_REPOSITORY, useClass: PrismaPropertyMasterStore },
    PropertyDetailsService, { provide: PROPERTY_DETAILS_REPOSITORY, useClass: PrismaPropertyDetailsRepository },
    PropertyExtrasService, { provide: PROPERTY_EXTRAS_REPOSITORY, useClass: PrismaPropertyExtrasRepository },
    PropertyLifecycleService, { provide: PROPERTY_LIFECYCLE_REPOSITORY, useClass: PrismaPropertyLifecycleRepository },
    { provide: APP_INTERCEPTOR, useClass: PropertyMetricsInterceptor },
  ],
  exports: [PROPERTY_TYPE_REPOSITORY, PROPERTY_MASTER_REPOSITORY, PROPERTY_DETAILS_REPOSITORY, PROPERTY_EXTRAS_REPOSITORY, PROPERTY_LIFECYCLE_REPOSITORY],
})
export class PropertyModule {}
