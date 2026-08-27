import { Inject, Injectable } from '@nestjs/common';
import {
  PROPERTY_TYPE_REPOSITORY,
  type PropertyTypeListQuery,
  type PropertyTypeListResult,
  type PropertyTypeRepository,
} from '../../domain/repositories/property-type.repository.js';
import { InvalidPropertyTypeException } from '../../domain/errors/property-type.errors.js';

const ALLOWED_FILTERS = new Set(['code', 'name', 'slug', 'isActive']);
const ALLOWED_SORTS = new Set([
  'code',
  'name',
  'slug',
  'isActive',
  'sortOrder',
  'createdAt',
  'updatedAt',
]);

@Injectable()
export class ListPropertyTypesUseCase {
  constructor(
    @Inject(PROPERTY_TYPE_REPOSITORY)
    private readonly repository: PropertyTypeRepository,
  ) {}

  async execute(query: PropertyTypeListQuery): Promise<PropertyTypeListResult> {
    if (query.filterField && !ALLOWED_FILTERS.has(query.filterField)) {
      throw new InvalidPropertyTypeException('Invalid filter field.');
    }
    if (query.filterValue !== undefined && !query.filterField) {
      throw new InvalidPropertyTypeException(
        'filterField is required when filterValue is provided.',
      );
    }
    if (!ALLOWED_SORTS.has(query.sortBy)) {
      throw new InvalidPropertyTypeException('Invalid sort field.');
    }
    if (query.page < 1) {
      throw new InvalidPropertyTypeException('Page must be greater than zero.');
    }
    if (query.limit < 1 || query.limit > 100) {
      throw new InvalidPropertyTypeException(
        'Limit must be between 1 and 100.',
      );
    }
    if (
      query.filterField === 'isActive' &&
      typeof query.filterValue !== 'boolean'
    ) {
      throw new InvalidPropertyTypeException(
        'isActive filterValue must be true or false.',
      );
    }
    return this.repository.list(query);
  }
}
