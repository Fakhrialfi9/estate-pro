import { Inject, Injectable } from '@nestjs/common';
import type { PropertyTypeEntity } from '../../domain/entities/property-type.entity.js';
import { PropertyTypeAlreadyExistsException } from '../../domain/errors/property-type.errors.js';
import {
  PROPERTY_TYPE_REPOSITORY,
  type PropertyTypeRepository,
} from '../../domain/repositories/property-type.repository.js';
import {
  SECURITY_AUDIT_REPOSITORY,
  type SecurityAuditRepository,
} from '../../../../common/audit/security-audit.port.js';
import {
  normalizeCode,
  normalizeDescription,
  normalizeIcon,
  normalizeName,
  normalizeSlug,
} from './property-type.normalizer.js';
import type { CreatePropertyTypeDto } from '../dto/create-property-type.dto.js';

export interface PropertyTypeMutationAuditContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
  actorUuid?: string | undefined;
}

@Injectable()
export class CreatePropertyTypeUseCase {
  constructor(
    @Inject(PROPERTY_TYPE_REPOSITORY)
    private readonly repository: PropertyTypeRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  async execute(
    input: CreatePropertyTypeDto,
    context: PropertyTypeMutationAuditContext,
  ): Promise<PropertyTypeEntity> {
    const data = {
      code: normalizeCode(input.code),
      name: normalizeName(input.name),
      slug: normalizeSlug(input.slug),
      description: normalizeDescription(input.description),
      icon: normalizeIcon(input.icon),
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    };

    if (await this.repository.findByCode(data.code)) {
      throw new PropertyTypeAlreadyExistsException('code');
    }
    if (await this.repository.findBySlug(data.slug)) {
      throw new PropertyTypeAlreadyExistsException('slug');
    }

    const propertyType = await this.repository.create(data);
    await this.audit.record({
      action: 'PROPERTY_CREATED',
      actorUuid: context.actorUuid,
      userUuid: context.actorUuid,
      entityType: 'property',
      entityUuid: propertyType.uuid,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
      result: 'SUCCESS',
    });
    return propertyType;
  }
}
