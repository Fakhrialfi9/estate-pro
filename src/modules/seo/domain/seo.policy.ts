import type { SeoMetadata, SeoResourceSnapshot, SeoRobots } from './seo.types.js';

export const normalizeSeoText = (value: string | null | undefined): string =>
  (value ?? '').replace(/\s+/g, ' ').trim();

export const normalizeKeywords = (value: unknown): string[] => {
  if (Array.isArray(value))
    return [...new Set(value.filter((item): item is string => typeof item === 'string').map(normalizeSeoText).filter(Boolean))];
  if (typeof value === 'string')
    return [...new Set(value.split(',').map(normalizeSeoText).filter(Boolean))];
  return [];
};

export const robotsFromIndexability = (indexable: boolean): SeoRobots =>
  indexable ? 'index,follow' : 'noindex,nofollow';

export const isPubliclyIndexable = (resource: SeoResourceSnapshot): boolean =>
  resource.published && resource.seo.robots !== 'noindex,nofollow' && resource.seo.robots !== 'noindex,follow';

export const buildCanonicalUrl = (baseUrl: string, path: string): string => {
  const base = new URL(baseUrl);
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('SEO canonical path must be internal');
  const url = new URL(path, base);
  if (url.origin !== base.origin) throw new Error('SEO canonical URL must use the application origin');
  url.search = '';
  url.hash = '';
  return url.toString();
};

const validateStoredCanonical = (baseUrl: string, value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  const url = new URL(value);
  if (url.origin !== new URL(baseUrl).origin || url.username || url.password) return fallback;
  url.search = '';
  url.hash = '';
  return url.toString();
};

export const buildSeoMetadata = (resource: SeoResourceSnapshot, baseUrl: string, path: string): SeoMetadata => {
  const title = normalizeSeoText(resource.seo.title) || normalizeSeoText(resource.title);
  const description = normalizeSeoText(resource.seo.description) || normalizeSeoText(resource.description) || title;
  const fallbackCanonical = buildCanonicalUrl(baseUrl, path);
  const canonicalUrl = validateStoredCanonical(baseUrl, resource.seo.canonicalUrl, fallbackCanonical);
  const robots: SeoRobots =
    resource.seo.robots === 'index,nofollow' || resource.seo.robots === 'noindex,follow' || resource.seo.robots === 'noindex,nofollow'
      ? resource.seo.robots
      : 'index,follow';
  const openGraph = resource.seo.openGraph;
  const twitter = resource.seo.twitter;
  const imageUrl = typeof openGraph?.imageUrl === 'string' && openGraph.imageUrl.length > 0 ? openGraph.imageUrl : null;
  return {
    title: title.slice(0, 60),
    description: description.slice(0, 160),
    canonicalUrl,
    robots,
    openGraph: {
      title: normalizeSeoText(openGraph?.title) || title.slice(0, 60),
      description: normalizeSeoText(openGraph?.description) || description.slice(0, 160),
      url: canonicalUrl,
      imageUrl,
      type: resource.resourceType === 'article' ? 'article' : 'website',
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title: normalizeSeoText(twitter?.title) || title.slice(0, 60),
      description: normalizeSeoText(twitter?.description) || description.slice(0, 160),
      imageUrl,
    },
    metadataVersion: typeof resource.seo.metadataVersion === 'string' ? resource.seo.metadataVersion : '1.0',
  };
};
