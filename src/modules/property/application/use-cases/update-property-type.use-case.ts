import { Inject, Injectable } from '@nestjs/common';
import type {
  PropertyTypeEntity,
  PropertyTypeUpdate,
} from '../../domain/entities/property-type.entity.js';
import {
  PropertyTypeAlreadyExistsException,
  PropertyTypeNotFoundException,
} from '../../domain/errors/property-type.errors.js';
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
import type { UpdatePropertyTypeDto } from '../dto/update-property-type.dto.js';
import type { PropertyTypeMutationAuditContext } from './create-property-type.use-case.js';

@Injectable()
export class UpdatePropertyTypeUseCase {
  constructor(
    @Inject(PROPERTY_TYPE_REPOSITORY)
    private readonly repository: PropertyTypeRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  async execute(
    uuid: string,
    input: UpdatePropertyTypeDto,
    context: PropertyTypeMutationAuditContext,
  ): Promise<PropertyTypeEntity> {
    const current = await this.repository.findById(uuid);
    if (!current) throw new PropertyTypeNotFoundException();

    const changes: PropertyTypeUpdate = {
      ...(input.code !== undefined ? { code: normalizeCode(input.code) } : {}),
      ...(input.name !== undefined ? { name: normalizeName(input.name) } : {}),
      ...(input.slug !== undefined ? { slug: normalizeSlug(input.slug) } : {}),
      ...(input.description !== undefined
        ? { description: normalizeDescription(input.description) }
        : {}),
      ...(input.icon !== undefined ? { icon: normalizeIcon(input.icon) } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    };

    if (changes.code !== undefined) {
      const duplicate = await this.repository.findByCode(changes.code);
      if (duplicate && duplicate.uuid !== uuid) {
        throw new PropertyTypeAlreadyExistsException('code');
      }
    }
    if (changes.slug !== undefined) {
      const duplicate = await this.repository.findBySlug(changes.slug);
      if (duplicate && duplicate.uuid !== uuid) {
        throw new PropertyTypeAlreadyExistsException('slug');
      }
    }

    if (Object.keys(changes).length === 0) return current;
    if (current.deletedAt !== null) throw new PropertyTypeNotFoundException();

    const updated = await this.repository.update(uuid, changes);
    await this.audit.record({
      action: 'PROPERTY_UPDATED',
      actorUuid: context.actorUuid,
      userUuid: context.actorUuid,
      entityType: 'property',
      entityUuid: updated.uuid,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
      result: 'SUCCESS',
      changes: this.buildChanges(current, updated),
    });
    return updated;
  }

  private buildChanges(
    before: PropertyTypeEntity,
    after: PropertyTypeEntity,
  ): Array<{
    field: string;
    oldValue: string | boolean | number | null;
    newValue: string | boolean | number | null;
  }> {
    const changes: Array<{
      field: string;
      oldValue: string | boolean | number | null;
      newValue: string | boolean | number | null;
    }> = [];

    const push = (
      field: string,
      oldValue: string | boolean | number | null,
      newValue: string | boolean | number | null,
    ): void => {
      if (oldValue !== newValue) changes.push({ field, oldValue, newValue });
    };

    push('code', before.code, after.code);
    push('name', before.name, after.name);
    push('slug', before.slug, after.slug);
    push('description', before.description, after.description);
    push('icon', before.icon, after.icon);
    push('isActive', before.isActive, after.isActive);
    push('sortOrder', before.sortOrder, after.sortOrder);
    return changes;
  }
}
