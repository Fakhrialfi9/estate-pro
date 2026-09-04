export type PropertySeoPublicMedia = {
  url: string;
  thumbnailUrl: string | null;
  type: 'IMAGE' | 'VIDEO' | 'FLOOR_PLAN' | 'VIRTUAL_TOUR';
  isCover: boolean;
  sortOrder: number;
};

export type PropertySeoPublicAmenity = {
  code: string;
  name: string;
  category: string;
};

export type PropertySeoPublicAgent = {
  name: string;
};

export type PropertySeoPublicSnapshot = {
  uuid: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  availabilityStatus: string;
  publishedAt: Date | null;
  updatedAt: Date;
  canonicalUrl: string | null;
  robots: string;
  price: string | null;
  currency: string | null;
  location: {
    address: string | null;
    city: string | null;
    province: string | null;
    country: string | null;
  } | null;
  images: PropertySeoPublicMedia[];
  amenities: PropertySeoPublicAmenity[];
  agent: PropertySeoPublicAgent | null;
};

export interface PropertySeoPublicPort {
  getPublicProperty(
    uuidOrSlug: string,
  ): Promise<PropertySeoPublicSnapshot | null>;
}

export const PROPERTY_SEO_PUBLIC_PORT = Symbol('PROPERTY_SEO_PUBLIC_PORT');
