import type {
  ActorContext,
  FacilityCategory,
  PageRequest,
  PageResult,
  PropertyStatus,
} from '../property-master.types.js';

export interface MasterQuery extends PageRequest {
  readonly isActive?: boolean;
  readonly parentUuid?: string;
  readonly category?: FacilityCategory;
  readonly status?: PropertyStatus;
  readonly typeUuid?: string;
  readonly categoryUuid?: string;
  readonly subcategoryUuid?: string;
}

export interface PropertyMasterRepository {
  createCategory(
    input: {
      typeUuid: string;
      code: string;
      name: string;
      slug?: string;
      description?: string;
      icon?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
    actor: ActorContext,
  ): Promise<unknown>;
  updateCategory(
    uuid: string,
    version: number,
    patch: Record<string, unknown>,
    actor: ActorContext,
  ): Promise<unknown>;
  getCategory(uuid: string): Promise<unknown>;
  listCategories(query: MasterQuery): Promise<PageResult<unknown>>;
  deleteCategory(uuid: string, actor: ActorContext): Promise<void>;
  createSubcategory(
    input: {
      categoryUuid: string;
      code: string;
      name: string;
      slug?: string;
      description?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
    actor: ActorContext,
  ): Promise<unknown>;
  updateSubcategory(
    uuid: string,
    version: number,
    patch: Record<string, unknown>,
    actor: ActorContext,
  ): Promise<unknown>;
  getSubcategory(uuid: string): Promise<unknown>;
  listSubcategories(query: MasterQuery): Promise<PageResult<unknown>>;
  deleteSubcategory(uuid: string, actor: ActorContext): Promise<void>;
  createLocation(
    level: 'country' | 'province' | 'city' | 'district' | 'subdistrict',
    input: Record<string, unknown>,
    actor: ActorContext,
  ): Promise<unknown>;
  updateLocation(
    level: string,
    uuid: string,
    version: number,
    patch: Record<string, unknown>,
    actor: ActorContext,
  ): Promise<unknown>;
  getLocation(level: string, uuid: string): Promise<unknown>;
  listLocations(
    level: string,
    query: MasterQuery,
  ): Promise<PageResult<unknown>>;
  deleteLocation(
    level: string,
    uuid: string,
    actor: ActorContext,
  ): Promise<void>;
  children(level: string, uuid: string): Promise<readonly unknown[]>;
  createFacility(
    input: {
      code: string;
      name: string;
      slug?: string;
      category: FacilityCategory;
      icon?: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
    actor: ActorContext,
  ): Promise<unknown>;
  updateFacility(
    uuid: string,
    version: number,
    patch: Record<string, unknown>,
    actor: ActorContext,
  ): Promise<unknown>;
  getFacility(uuid: string): Promise<unknown>;
  listFacilities(query: MasterQuery): Promise<PageResult<unknown>>;
  deleteFacility(uuid: string, actor: ActorContext): Promise<void>;
  createProperty(
    input: Record<string, unknown>,
    actor: ActorContext,
  ): Promise<unknown>;
  getProperty(uuid: string): Promise<unknown>;
  listProperties(query: MasterQuery): Promise<PageResult<unknown>>;
  updateProperty(
    uuid: string,
    version: number,
    patch: Record<string, unknown>,
    actor: ActorContext,
  ): Promise<unknown>;
  deleteProperty(uuid: string, actor: ActorContext): Promise<void>;
  restoreProperty(uuid: string, actor: ActorContext): Promise<unknown>;
  duplicateProperty(uuid: string, actor: ActorContext): Promise<unknown>;
}

export const PROPERTY_MASTER_REPOSITORY = Symbol('PROPERTY_MASTER_REPOSITORY');
