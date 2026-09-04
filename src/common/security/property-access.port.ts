export const PROPERTY_ACCESS_QUERY = Symbol('PROPERTY_ACCESS_QUERY');

export type PropertyAccessQuery = Readonly<{
  canAccessProperty(input: {
    principalUuid: string;
    propertyUuid: string;
    includeDeleted: boolean;
  }): Promise<boolean>;
  canAccessListing(input: {
    principalUuid: string;
    listingUuid: string;
  }): Promise<boolean>;
}>;
