export type SeoResourceType = 'property' | 'listing' | 'article' | 'page';

export type SeoRobots = 'index,follow' | 'noindex,follow' | 'index,nofollow' | 'noindex,nofollow';

export interface SeoMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: SeoRobots;
  openGraph: {
    title: string;
    description: string;
    url: string;
    imageUrl: string | null;
    type: 'website' | 'article';
  };
  twitter: {
    card: 'summary' | 'summary_large_image';
    title: string;
    description: string;
    imageUrl: string | null;
  };
  metadataVersion: string;
}

export interface SeoResourceSnapshot {
  resourceType: SeoResourceType;
  uuid: string;
  slug: string;
  title: string;
  description: string | null;
  language: string;
  updatedAt: Date;
  publishedAt: Date | null;
  published: boolean;
  seo: Partial<SeoMetadata> & { keywords?: string[] | null };
}

export interface SeoRedirect {
  uuid: string;
  sourcePath: string;
  destination: string;
  statusCode: 301 | 302;
  isActive: boolean;
}

export const INDEXABLE_ROBOTS: SeoRobots = 'index,follow';
export const NON_INDEXABLE_ROBOTS: SeoRobots = 'noindex,nofollow';
