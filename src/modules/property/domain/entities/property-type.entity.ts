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
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 150;
const MAX_CODE_LENGTH = 50;
const MAX_SLUG_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_ICON_LENGTH = 100;
const MAX_SORT_ORDER = 1_000_000;

export class PropertyTypeEntity {
  private constructor(private readonly snapshot: PropertyTypeSnapshot) {}

  static create(snapshot: PropertyTypeSnapshot): PropertyTypeEntity {
    PropertyTypeEntity.validate(snapshot);
    return new PropertyTypeEntity({ ...snapshot });
  }

  get uuid(): string { return this.snapshot.uuid; }
  get code(): string { return this.snapshot.code; }
  get name(): string { return this.snapshot.name; }
  get slug(): string { return this.snapshot.slug; }
  get description(): string | null { return this.snapshot.description; }
  get icon(): string | null { return this.snapshot.icon; }
  get isActive(): boolean { return this.snapshot.isActive; }
  get sortOrder(): number { return this.snapshot.sortOrder; }
  get createdAt(): Date { return this.snapshot.createdAt; }
  get updatedAt(): Date { return this.snapshot.updatedAt; }
  get deletedAt(): Date | null { return this.snapshot.deletedAt; }

  isDeleted(): boolean { return this.snapshot.deletedAt !== null; }
  isAccessible(): boolean { return !this.isDeleted() && this.isActive; }

  update(changes: PropertyTypeUpdate): void {
    const next: PropertyTypeSnapshot = {
      ...this.snapshot,
      ...(changes.code !== undefined ? { code: changes.code } : {}),
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.slug !== undefined ? { slug: changes.slug } : {}),
      ...(changes.description !== undefined ? { description: changes.description } : {}),
      ...(changes.icon !== undefined ? { icon: changes.icon } : {}),
      ...(changes.isActive !== undefined ? { isActive: changes.isActive } : {}),
      ...(changes.sortOrder !== undefined ? { sortOrder: changes.sortOrder } : {}),
    };
    PropertyTypeEntity.validate(next);
    this.snapshot.code = next.code;
    this.snapshot.name = next.name;
    this.snapshot.slug = next.slug;
    this.snapshot.description = next.description;
    this.snapshot.icon = next.icon;
    this.snapshot.isActive = next.isActive;
    this.snapshot.sortOrder = next.sortOrder;
  }

  softDelete(at: Date = new Date()): void {
    if (this.snapshot.deletedAt !== null) return;
    this.snapshot.deletedAt = at;
    this.snapshot.isActive = false;
  }

  toSnapshot(): PropertyTypeSnapshot { return { ...this.snapshot }; }

  private static validate(snapshot: PropertyTypeSnapshot): void {
    if (!UUID_PATTERN.test(snapshot.uuid)) throw new Error('Invalid property type UUID');
    if (!CODE_PATTERN.test(snapshot.code) || snapshot.code.length > MAX_CODE_LENGTH) {
      throw new Error('Invalid property type code');
    }
    if (snapshot.code.trim() !== snapshot.code) throw new Error('Invalid property type code');
    if (snapshot.name.trim().length < MIN_NAME_LENGTH || snapshot.name.length > MAX_NAME_LENGTH) {
      throw new Error('Invalid property type name');
    }
    if (!SLUG_PATTERN.test(snapshot.slug) || snapshot.slug.length > MAX_SLUG_LENGTH) {
      throw new Error('Invalid property type slug');
    }
    if (snapshot.description !== null && snapshot.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error('Invalid property type description');
    }
    if (snapshot.icon !== null && (snapshot.icon.trim().length === 0 || snapshot.icon.length > MAX_ICON_LENGTH)) {
      throw new Error('Invalid property type icon');
    }
    if (!Number.isInteger(snapshot.sortOrder) || snapshot.sortOrder < 0 || snapshot.sortOrder > MAX_SORT_ORDER) {
      throw new Error('Invalid property type sort order');
    }
    if (snapshot.deletedAt !== null && snapshot.isActive) {
      throw new Error('Deleted property type cannot be active');
    }
  }
}
