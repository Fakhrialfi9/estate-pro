import { Inject, Injectable } from '@nestjs/common';
import {
  PROPERTY_TYPE_REPOSITORY,
  type PropertyTypeRepository,
} from '../../domain/repositories/property-type.repository.js';
import { PropertyTypeNotFoundException } from '../../domain/errors/property-type.errors.js';
import type { PropertyTypeEntity } from '../../domain/entities/property-type.entity.js';
import {
  SECURITY_AUDIT_REPOSITORY,
  type SecurityAuditRepository,
} from '../../../../common/audit/security-audit.port.js';
import type { PropertyTypeMutationAuditContext } from './create-property-type.use-case.js';

@Injectable()
export class DeletePropertyTypeUseCase {
  constructor(
    @Inject(PROPERTY_TYPE_REPOSITORY)
    private readonly repository: PropertyTypeRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  async execute(
    uuid: string,
    context: PropertyTypeMutationAuditContext,
  ): Promise<void> {
    const propertyType: PropertyTypeEntity | null =
      await this.repository.findById(uuid);
    if (!propertyType) throw new PropertyTypeNotFoundException();
    if (propertyType.deletedAt !== null)
      throw new PropertyTypeNotFoundException();

    await this.repository.softDelete(uuid);
    await this.audit.record({
      action: 'PROPERTY_TYPE_DELETED',
      actorUuid: context.actorUuid,
      userUuid: context.actorUuid,
      entityType: 'property_type',
      entityUuid: propertyType.uuid,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
      result: 'SUCCESS',
    });
  }
}
