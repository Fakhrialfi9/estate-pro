import { describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PropertyDetailsService } from '../../../src/modules/property/application/property-details.service.js';
import { PropertyMasterService } from '../../../src/modules/property/application/property-master.service.js';
import { PropertyLifecycleService } from '../../../src/modules/property/application/property-lifecycle.service.js';
import { ListPropertyTypesUseCase } from '../../../src/modules/property/application/use-cases/list-property-types.use-case.js';
import { DeletePropertyTypeUseCase } from '../../../src/modules/property/application/use-cases/delete-property-type.use-case.js';
import { ListingService } from '../../../src/modules/property/listing/application/listing.service.js';
import { ListingExpiryWorker } from '../../../src/modules/property/listing/application/listing-expiry.worker.js';
import { PropertyTypeEntity } from '../../../src/modules/property/domain/entities/property-type.entity.js';
import {
  MasterConcurrencyError,
  MasterConflictError,
  MasterHierarchyError,
  MasterInUseError,
  MasterNotFoundError,
  MasterStateError,
} from '../../../src/modules/property/domain/errors.js';
import {
  ListingConflictError,
  ListingNotFoundError,
  ListingStateError,
  ListingValidationError,
} from '../../../src/modules/property/listing/infrastructure/listing.repository.js';
import {
  maskSensitive,
  hashSensitive,
  validateCertificateDates,
  validateCertificateInput,
  validateFinancialInvariants,
  validateLegalInvariants,
  validateMedia,
  validateSeoInvariants,
  validateUtilityInvariants,
} from '../../../src/modules/property/domain/property-extras.js';

