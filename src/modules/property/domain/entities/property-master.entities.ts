import {
  assertAvailability,
  assertTransition,
  normalizeCode,
  normalizeSlug,
  type AvailabilityStatus,
  type FacilityCategory,
  type PropertyStatus,
} from '../property-master.types.js';

export class PropertyCategory {
  constructor(
    readonly uuid: string,
    readonly propertyTypeId: bigint,
    public code: string,
    public name: string,
    public slug: string,
    public description: string | null,
    public icon: string | null,
    public isActive: boolean,
    public sortOrder: number,
  ) {
    this.code = normalizeCode(code);
    this.slug = normalizeSlug(slug || name);
    this.validate();
  }
  validate(): void {
    if (!this.code || this.code.length > 50)
      throw new Error('Invalid category code');
    if (!this.name.trim() || this.name.length > 150)
      throw new Error('Invalid category name');
    if (!this.slug || this.slug.length > 100)
      throw new Error('Invalid category slug');
  }
}
export class PropertySubcategory {
  constructor(
    readonly uuid: string,
    readonly propertyCategoryId: bigint,
    public code: string,
    public name: string,
    public slug: string,
    public description: string | null,
    public isActive: boolean,
    public sortOrder: number,
  ) {
    this.code = normalizeCode(code);
    this.slug = normalizeSlug(slug || name);
    this.validate();
  }
  validate(): void {
    if (!this.code || this.code.length > 50)
      throw new Error('Invalid subcategory code');
    if (!this.name.trim() || this.name.length > 150)
      throw new Error('Invalid subcategory name');
    if (!this.slug || this.slug.length > 100)
      throw new Error('Invalid subcategory slug');
  }
}
export class Facility {
  constructor(
    readonly uuid: string,
    public code: string,
    public name: string,
    public slug: string,
    public category: FacilityCategory,
    public icon: string | null,
    public description: string | null,
    public sortOrder: number,
    public isActive: boolean,
  ) {
    this.code = normalizeCode(code);
    this.slug = normalizeSlug(slug || name);
    if (!this.code || !this.name.trim() || !this.slug)
      throw new Error('Invalid facility');
  }
}
export class Property {
  constructor(
    readonly uuid: string,
    readonly typeId: bigint,
    readonly categoryId: bigint,
    readonly subcategoryId: bigint | null,
    public businessCode: string,
    public referenceNumber: string,
    public title: string,
    public slug: string,
    public shortDescription: string | null,
    public description: string | null,
    public status: PropertyStatus,
    public availabilityStatus: AvailabilityStatus,
    public availableFrom: Date | null,
    public availableTo: Date | null,
    public version: number,
    public createdAt: Date,
    public updatedAt: Date,
    public publishedAt: Date | null,
    public verifiedAt: Date | null,
    public createdBy: string | null,
    public updatedBy: string | null,
    public verifiedBy: string | null,
    public deletedAt: Date | null,
    public deletedBy: string | null,
  ) {
    this.slug = normalizeSlug(slug || title);
    assertAvailability(availableFrom, availableTo);
    if (!title.trim()) throw new Error('title is required');
    if (!this.slug) throw new Error('slug is required');
    if (this.version < 1) throw new Error('version must be positive');
  }
  transitionTo(next: PropertyStatus, actorUuid?: string): void {
    assertTransition(this.status, next);
    this.status = next;
    this.updatedBy = actorUuid ?? this.updatedBy;
    if (next === 'ACTIVE' && !this.publishedAt) this.publishedAt = new Date();
  }
  updateAvailability(
    status: AvailabilityStatus,
    from: Date | null,
    to: Date | null,
  ): void {
    assertAvailability(from, to);
    this.availabilityStatus = status;
    this.availableFrom = from;
    this.availableTo = to;
  }
}
