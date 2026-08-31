export const CONTENT_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'ARCHIVED',
  'REJECTED',
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const;
export type ContentVisibility = (typeof VISIBILITIES)[number];

export const CONTENT_FORMATS = ['RICH_TEXT', 'MARKDOWN', 'BLOCKS'] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const ARTICLE_TYPES = [
  'ARTICLE',
  'NEWS',
  'PRESS_RELEASE',
  'GUIDE',
  'CASE_STUDY',
] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

export const RESOURCE_TYPES = [
  'article',
  'page',
  'category',
  'tag',
  'faq',
  'testimonial',
  'banner',
  'menu',
  'media',
  'redirect',
] as const;
export type ContentResourceType = (typeof RESOURCE_TYPES)[number];

export type AuditContext = {
  actorUuid?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
};

export type PaginationQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: ContentStatus;
  language?: string;
  sortBy?:
    | 'createdAt'
    | 'updatedAt'
    | 'publishedAt'
    | 'sortOrder'
    | 'priority'
    | 'title';
  sortDirection?: 'asc' | 'desc';
};

export type ContentSeoInput = {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string;
  canonicalUrl?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImageUrl?: string;
  structuredData?: unknown;
};

export type ContentItem = {
  uuid: string;
  title: string;
  slug: string;
  status: ContentStatus;
  visibility: ContentVisibility;
  language: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  scheduledAt: Date | null;
};

export type ArticleResponse = ContentItem & {
  subtitle: string | null;
  excerpt: string | null;
  content: unknown;
  contentFormat: ContentFormat;
  type: ArticleType;
  featured: boolean;
  allowComments: boolean;
  wordCount: number;
  readingTimeMin: number;
  authorUuid: string | null;
  category: { uuid: string; name: string; slug: string } | null;
  tags: Array<{ uuid: string; name: string; slug: string }>;
  coverMedia: { uuid: string; url: string | null; alt: string | null } | null;
  seo: Record<string, unknown> | null;
  permissions?: Record<string, boolean>;
};

export type PagedResult<T> = {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};
