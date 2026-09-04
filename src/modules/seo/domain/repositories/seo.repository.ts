import type { SeoRedirect, SeoResourceSnapshot } from '../seo.types.js';

export const SEO_REPOSITORY = Symbol('SEO_REPOSITORY');

export interface SeoRepository {
  getPublicResource(
    resourceType: 'property' | 'listing' | 'article' | 'page',
    identifier: string,
    language?: string,
  ): Promise<SeoResourceSnapshot | null>;
  listPublicResources(): Promise<SeoResourceSnapshot[]>;
  getRedirect(sourcePath: string): Promise<SeoRedirect | null>;
  listRedirects(): Promise<SeoRedirect[]>;
  upsertRedirect(input: {
    sourcePath: string;
    destination: string;
    statusCode: 301 | 302;
    actorUuid: string;
  }): Promise<SeoRedirect>;
  deactivateRedirect(uuid: string, actorUuid: string): Promise<void>;
  upsertPropertyMetadata(
    propertyUuid: string,
    input: {
      title?: string | null;
      description?: string | null;
      canonicalUrl?: string | null;
      robots?:
        | 'INDEX_FOLLOW'
        | 'NOINDEX_FOLLOW'
        | 'INDEX_NOFOLLOW'
        | 'NOINDEX_NOFOLLOW';
      ogImageUrl?: string | null;
      metadataVersion?: string;
    },
    actorUuid: string,
  ): Promise<SeoResourceSnapshot>;
  upsertContentMetadata(
    resourceType: 'article' | 'page',
    resourceUuid: string,
    input: {
      metaTitle?: string | null;
      metaDescription?: string | null;
      canonicalUrl?: string | null;
      robots?: string | null;
      ogTitle?: string | null;
      ogDescription?: string | null;
      ogImageUrl?: string | null;
      twitterTitle?: string | null;
      twitterDescription?: string | null;
      twitterImageUrl?: string | null;
    },
    actorUuid: string,
  ): Promise<SeoResourceSnapshot>;
}
