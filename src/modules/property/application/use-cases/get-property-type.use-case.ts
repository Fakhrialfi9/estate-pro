import { Inject, Injectable } from '@nestjs/common';
import type { PropertyTypeEntity } from '../../domain/entities/property-type.entity.js';
import { PropertyTypeNotFoundException } from '../../domain/errors/property-type.errors.js';
import { PROPERTY_TYPE_REPOSITORY, type PropertyTypeRepository } from '../../domain/repositories/property-type.repository.js';

@Injectable()
export class GetPropertyTypeUseCase {
  constructor(@Inject(PROPERTY_TYPE_REPOSITORY) private readonly repository: PropertyTypeRepository) {}

  async execute(uuid: string): Promise<PropertyTypeEntity> {
    const propertyType = await this.repository.findById(uuid);
    if (!propertyType) throw new PropertyTypeNotFoundException();
    return propertyType;
  }
}
