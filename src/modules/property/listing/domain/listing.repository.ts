import type {
  ListingPaymentInput,
  ListingPricingInput,
  ListingStatus,
  ListingTransactionType,
  ListingVisibility,
  PropertyOwnerType,
} from './listing.types.js';
export interface ListingActor {
  readonly actorUuid?: string | undefined;
  readonly ipAddress?: string | undefined;
  readonly userAgent?: string | undefined;
  readonly requestId?: string | undefined;
}
export interface CreateListingInput {
  readonly propertyUuid: string;
  readonly listingCode: string;
  readonly transactionType: ListingTransactionType;
  readonly visibility?: ListingVisibility | undefined;
  readonly featured?: boolean | undefined;
  readonly premium?: boolean | undefined;
  readonly expiresAt?: Date | null | undefined;
  readonly price?: ListingPricingInput | undefined;
  readonly payments?: readonly ListingPaymentInput[] | undefined;
}
export interface UpdateListingInput {
  readonly listingCode?: string | undefined;
  readonly transactionType?: ListingTransactionType | undefined;
  readonly visibility?: ListingVisibility | undefined;
  readonly featured?: boolean | undefined;
  readonly premium?: boolean | undefined;
  readonly expiresAt?: Date | null | undefined;
  readonly price?: ListingPricingInput | undefined;
  readonly payments?: readonly ListingPaymentInput[] | undefined;
}
export interface PropertySearchQuery {
  readonly page: number;
  readonly limit: number;
  readonly search?: string | undefined;
  readonly typeUuid?: string | undefined;
  readonly categoryUuid?: string | undefined;
  readonly subcategoryUuid?: string | undefined;
  readonly countryUuid?: string | undefined;
  readonly provinceUuid?: string | undefined;
  readonly cityUuid?: string | undefined;
  readonly districtUuid?: string | undefined;
  readonly minPrice?: string | undefined;
  readonly maxPrice?: string | undefined;
  readonly minLandArea?: string | undefined;
  readonly maxLandArea?: string | undefined;
  readonly minBuildingArea?: string | undefined;
  readonly maxBuildingArea?: string | undefined;
  readonly minBedrooms?: number | undefined;
  readonly maxBedrooms?: number | undefined;
  readonly minBathrooms?: string | undefined;
  readonly maxBathrooms?: string | undefined;
  readonly facilityUuids?: readonly string[] | undefined;
  readonly transactionType?: ListingTransactionType | undefined;
  readonly listingStatus?: ListingStatus | undefined;
  readonly featured?: boolean | undefined;
  readonly verified?: boolean | undefined;
  readonly sortBy?: PropertySortField | undefined;
  readonly sortDirection?: 'asc' | 'desc' | undefined;
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
  search(query: PropertySearchQuery): Promise<{
    items: readonly unknown[];
    total: number;
    page: number;
    limit: number;
  }>;
}
export const LISTING_REPOSITORY = Symbol('LISTING_REPOSITORY');
