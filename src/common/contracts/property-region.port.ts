export interface PropertyRegionPort {
  isKnownRegion(uuid: string): Promise<boolean>;
}
export const PROPERTY_REGION_PORT = Symbol('PROPERTY_REGION_PORT');
