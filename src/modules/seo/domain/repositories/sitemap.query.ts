export type SitemapEntry = {
  loc: string;
  lastmod: string;
};

export interface SitemapQuery {
  count(): Promise<number>;
  page(part: number, chunkSize: number): Promise<SitemapEntry[]>;
}

export const SITEMAP_QUERY = Symbol('SITEMAP_QUERY');
