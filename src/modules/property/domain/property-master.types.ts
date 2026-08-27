export type PropertyStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'ACTIVE'
  | 'ARCHIVED'
  | 'SOLD'
  | 'RENTED';
export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE';
export type FacilityCategory =
  | 'OUTDOOR'
  | 'SECURITY'
  | 'TECHNOLOGY'
  | 'PARKING'
  | 'CLIMATE'
  | 'UTILITY'
  | 'ACCESSIBILITY'
  | 'RECREATION'
  | 'OTHER';
export interface ActorContext {
  readonly actorUuid?: string;
  readonly requestId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}
export interface PageRequest {
  readonly page?: number;
  readonly limit?: number;
  readonly search?: string;
  readonly sortBy?: string;
  readonly sortDirection?: 'asc' | 'desc';
}
export interface PageResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}
export const transitions: Readonly<
  Record<PropertyStatus, readonly PropertyStatus[]>
> = {
  DRAFT: ['IN_REVIEW', 'ACTIVE', 'ARCHIVED'],
  IN_REVIEW: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
  ACTIVE: ['ARCHIVED', 'SOLD', 'RENTED'],
  ARCHIVED: ['DRAFT', 'ACTIVE'],
  SOLD: [],
  RENTED: ['ACTIVE', 'ARCHIVED'],
};
export const normalizeCode = (v: string): string =>
  v
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
export const normalizeSlug = (v: string): string =>
  v
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
export const assertTransition = (
  from: PropertyStatus,
  to: PropertyStatus,
): void => {
  if (from !== to && !transitions[from].includes(to))
    throw new Error(`Invalid property status transition: ${from} -> ${to}`);
};
export const assertAvailability = (
  from?: Date | null,
  to?: Date | null,
): void => {
  if (from && to && from > to)
    throw new Error('availableFrom must not be later than availableTo');
};
