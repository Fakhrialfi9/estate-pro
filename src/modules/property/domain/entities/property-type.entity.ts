import { InvalidPropertyTypeException } from '../errors/property-type.errors.js';

export interface PropertyTypeSnapshot {
  uuid: string;
  code: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
export interface PropertyTypeUpdate {
  code?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_PATTERN = /^[A-Z0-9](?:[A-Z0-9_-]*[A-Z0-9])?$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export class PropertyTypeEntity {
  private constructor(private readonly snapshot: PropertyTypeSnapshot) {}
  static create(snapshot: PropertyTypeSnapshot): PropertyTypeEntity {
    PropertyTypeEntity.validate(snapshot);
    return new PropertyTypeEntity({ ...snapshot });
  }
  get uuid() {
    return this.snapshot.uuid;
  }
  get code() {
    return this.snapshot.code;
  }
  get name() {
    return this.snapshot.name;
  }
  get slug() {
    return this.snapshot.slug;
  }
  get description() {
    return this.snapshot.description;
  }
  get icon() {
    return this.snapshot.icon;
  }
  get isActive() {
    return this.snapshot.isActive;
  }
  get sortOrder() {
    return this.snapshot.sortOrder;
  }
  get createdAt() {
    return this.snapshot.createdAt;
  }
  get updatedAt() {
    return this.snapshot.updatedAt;
  }
  get deletedAt() {
    return this.snapshot.deletedAt;
  }
  isDeleted() {
    return this.snapshot.deletedAt !== null;
  }
  isAccessible() {
    return !this.isDeleted() && this.isActive;
  }
  update(changes: PropertyTypeUpdate): void {
    const next = { ...this.snapshot, ...changes };
    PropertyTypeEntity.validate(next);
    this.snapshot.code = next.code;
    this.snapshot.name = next.name;
    this.snapshot.slug = next.slug;
    this.snapshot.description = next.description ?? null;
    this.snapshot.icon = next.icon ?? null;
    this.snapshot.isActive = next.isActive ?? true;
    this.snapshot.sortOrder = next.sortOrder ?? 0;
  }
  softDelete(at: Date = new Date()): void {
    if (this.snapshot.deletedAt !== null) return;
    this.snapshot.deletedAt = at;
    this.snapshot.isActive = false;
  }
  toSnapshot(): PropertyTypeSnapshot {
    return { ...this.snapshot };
  }
  private static validate(snapshot: PropertyTypeSnapshot): void {
    if (!UUID_PATTERN.test(snapshot.uuid))
      throw new InvalidPropertyTypeException('Invalid property type UUID.');
    if (
      !CODE_PATTERN.test(snapshot.code) ||
      snapshot.code.length > 50 ||
      snapshot.code.trim() !== snapshot.code
    )
      throw new InvalidPropertyTypeException('Invalid property type code.');
    if (snapshot.name.trim().length < 2 || snapshot.name.length > 150)
      throw new InvalidPropertyTypeException('Invalid property type name.');
    if (!SLUG_PATTERN.test(snapshot.slug) || snapshot.slug.length > 100)
      throw new InvalidPropertyTypeException('Invalid property type slug.');
    if (snapshot.description !== null && snapshot.description.length > 5000)
      throw new InvalidPropertyTypeException(
        'Invalid property type description.',
      );
    if (
      snapshot.icon !== null &&
      (snapshot.icon.trim().length === 0 || snapshot.icon.length > 100)
    )
      throw new InvalidPropertyTypeException('Invalid property type icon.');
    if (
      !Number.isInteger(snapshot.sortOrder) ||
      snapshot.sortOrder < 0 ||
      snapshot.sortOrder > 1000000
    )
      throw new InvalidPropertyTypeException(
        'Invalid property type sort order.',
      );
    if (snapshot.deletedAt !== null && snapshot.isActive)
      throw new InvalidPropertyTypeException(
        'Deleted property type cannot be active.',
      );
  }
}
