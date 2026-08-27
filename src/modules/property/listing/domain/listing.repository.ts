import type {
  ListingPaymentInput,
  ListingPricingInput,
  ListingStatus,
  ListingTransactionType,
  ListingVisibility,
  PropertyOwnerType,
} from './listing.types.js';
export interface ListingActor {
  readonly actorUuid?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
}
export interface CreateListingInput {
  readonly propertyUuid: string;
  readonly listingCode: string;
  readonly transactionType: ListingTransactionType;
  readonly visibility?: ListingVisibility;
  readonly featured?: boolean;
  readonly premium?: boolean;
  readonly expiresAt?: Date | null;
  readonly price?: ListingPricingInput;
  readonly payments?: readonly ListingPaymentInput[];
}
export interface UpdateListingInput {
  readonly listingCode?: string;
  readonly transactionType?: ListingTransactionType;
  readonly visibility?: ListingVisibility;
  readonly featured?: boolean;
  readonly premium?: boolean;
  readonly expiresAt?: Date | null;
  readonly price?: ListingPricingInput;
  readonly payments?: readonly ListingPaymentInput[];
}
export interface PropertySearchQuery {
  readonly page: number;
  readonly limit: number;
  readonly search?: string;
  readonly typeUuid?: string;
  readonly categoryUuid?: string;
  readonly subcategoryUuid?: string;
  readonly countryUuid?: string;
  readonly provinceUuid?: string;
  readonly cityUuid?: string;
  readonly districtUuid?: string;
  readonly minPrice?: string;
  readonly maxPrice?: string;
  readonly minLandArea?: string;
  readonly maxLandArea?: string;
  readonly minBuildingArea?: string;
  readonly maxBuildingArea?: string;
  readonly minBedrooms?: number;
  readonly maxBedrooms?: number;
  readonly minBathrooms?: string;
  readonly maxBathrooms?: string;
  readonly facilityUuids?: readonly string[];
  readonly transactionType?: ListingTransactionType;
  readonly listingStatus?: ListingStatus;
  readonly featured?: boolean;
  readonly verified?: boolean;
  readonly sortBy?: PropertySortField;
  readonly sortDirection?: 'asc' | 'desc';
}
export type PropertySortField =
  | 'price'
  | 'createdAt'
  | 'updatedAt'
  | 'views'
  | 'featured';
export interface ListingRepository {
  create(input: CreateListingInput, actor: ListingActor): Promise<unknown>;
  findOne(uuid: string): Promise<unknown>;
  update(
    uuid: string,
    version: number,
    input: UpdateListingInput,
    actor: ListingActor,
  ): Promise<unknown>;
  transition(
    uuid: string,
    version: number,
    to: ListingStatus,
    actor: ListingActor,
    reason?: string,
  ): Promise<unknown>;
  expireDue(actor: ListingActor): Promise<readonly string[]>;
  duplicate(uuid: string, actor: ListingActor): Promise<unknown>;
  assignAgent(
    propertyUuid: string,
    agentUserUuid: string,
    agentDisplayName: string,
    primary: boolean,
    actor: ListingActor,
  ): Promise<unknown>;
  changeAgent(
    propertyUuid: string,
    assignmentUuid: string,
    agentUserUuid: string,
    agentDisplayName: string,
    primary: boolean,
    actor: ListingActor,
  ): Promise<unknown>;
  assignOwner(
    propertyUuid: string,
    ownerType: PropertyOwnerType,
    ownerDisplayName: string,
    actor: ListingActor,
  ): Promise<unknown>;
  getPropertyDetail(
    propertyUuid: string,
    viewerUserUuid?: string,
  ): Promise<unknown>;
  search(
    query: PropertySearchQuery,
  ): Promise<{
    items: readonly unknown[];
    total: number;
    page: number;
    limit: number;
  }>;
}
export const LISTING_REPOSITORY = Symbol('LISTING_REPOSITORY');
