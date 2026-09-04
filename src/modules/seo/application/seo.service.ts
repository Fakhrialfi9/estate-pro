import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildSeoMetadata,
  isPubliclyIndexable,
  normalizeSeoText,
} from '../domain/seo.policy.js';
import type {
  SeoMetadata,
  SeoRedirect,
  SeoResourceSnapshot,
} from '../domain/seo.types.js';
import {
  SEO_REPOSITORY,
  type SeoRepository,
} from '../domain/repositories/seo.repository.js';

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

@Injectable()
export class SeoService {
  constructor(
    @Inject(SEO_REPOSITORY) private readonly repository: SeoRepository,
    private readonly config: ConfigService,
  ) {}

  async getPublicResource(
    resourceType: SeoResourceSnapshot['resourceType'],
    identifier: string,
    language = 'id',
  ): Promise<{ resource: SeoResourceSnapshot; metadata: SeoMetadata }> {
    const resource = await this.repository.getPublicResource(
      resourceType,
      identifier,
      language,
    );
    if (!resource || !isPubliclyIndexable(resource)) {
      throw new NotFoundException('Public SEO resource not found');
    }
    return {
      resource,
      metadata: buildSeoMetadata(
        resource,
        this.baseUrl(),
        this.resourcePath(resource),
      ),
    };
  }

  async getPublicMetadata(
    resourceType: SeoResourceSnapshot['resourceType'],
    identifier: string,
    language = 'id',
  ): Promise<{
    resourceType: SeoResourceSnapshot['resourceType'];
    uuid: string;
    slug: string;
    metadata: SeoMetadata;
  }> {
    const result = await this.getPublicResource(
      resourceType,
      identifier,
      language,
    );
    return {
      resourceType,
      uuid: result.resource.uuid,
      slug: result.resource.slug,
      metadata: result.metadata,
    };
  }

  async getPublicStructuredData(
    resourceType: SeoResourceSnapshot['resourceType'],
    identifier: string,
    language = 'id',
  ): Promise<Record<string, unknown>> {
    const { resource, metadata } = await this.getPublicResource(
      resourceType,
      identifier,
      language,
    );
    const base = {
      '@context': 'https://schema.org',
      name: metadata.title,
      description: metadata.description,
      url: metadata.canonicalUrl,
      dateModified: resource.updatedAt.toISOString(),
    };
    if (resourceType === 'article') {
      return {
        ...base,
        '@type': 'Article',
        headline: metadata.title,
        datePublished: resource.publishedAt?.toISOString(),
      };
    }
    if (resourceType === 'listing') return { ...base, '@type': 'Offer' };
    return { ...base, '@type': 'WebPage' };
  }

  async updatePropertyMetadata(
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
  ) {
    this.validateMetadataInput(
      input.title,
      input.description,
      input.canonicalUrl,
    );
    return this.repository.upsertPropertyMetadata(
      propertyUuid,
      {
        ...input,
        title:
          input.title === undefined ? undefined : normalizeSeoText(input.title),
        description:
          input.description === undefined
            ? undefined
            : normalizeSeoText(input.description),
        canonicalUrl:
          input.canonicalUrl === undefined || input.canonicalUrl === null
            ? input.canonicalUrl
            : this.validateCanonicalUrl(input.canonicalUrl),
      },
      actorUuid,
    );
  }

  async updateContentMetadata(
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
  ) {
    this.validateMetadataInput(
      input.metaTitle,
      input.metaDescription,
      input.canonicalUrl,
    );
    return this.repository.upsertContentMetadata(
      resourceType,
      resourceUuid,
      {
        ...input,
        metaTitle:
          input.metaTitle === undefined
            ? undefined
            : normalizeSeoText(input.metaTitle),
        metaDescription:
          input.metaDescription === undefined
            ? undefined
            : normalizeSeoText(input.metaDescription),
        canonicalUrl:
          input.canonicalUrl === undefined || input.canonicalUrl === null
            ? input.canonicalUrl
            : this.validateCanonicalUrl(input.canonicalUrl),
      },
      actorUuid,
    );
  }

  async resolveRedirect(sourcePath: string): Promise<SeoRedirect | null> {
    return this.repository.getRedirect(this.normalizeInternalPath(sourcePath));
  }

  async createRedirect(input: {
    sourcePath: string;
    destination: string;
    statusCode: 301 | 302;
    actorUuid: string;
  }): Promise<SeoRedirect> {
    const sourcePath = this.normalizeInternalPath(input.sourcePath);
    const destination = this.normalizeInternalPath(input.destination);
    if (sourcePath === destination) {
      throw new ConflictException(
        'Redirect source and destination must differ',
      );
    }
    if (await this.wouldCycle(sourcePath, destination)) {
      throw new ConflictException('Redirect cycle detected');
    }
    return this.repository.upsertRedirect({
      ...input,
      sourcePath,
      destination,
    });
  }

  async deactivateRedirect(uuid: string, actorUuid: string): Promise<void> {
    await this.repository.deactivateRedirect(uuid, actorUuid);
  }

  async sitemapChunk(part: number, chunkSize = 50000): Promise<string> {
    if (
      !Number.isInteger(part) ||
      part < 1 ||
      !Number.isInteger(chunkSize) ||
      chunkSize < 1 ||
      chunkSize > 50000
    ) {
      throw new BadRequestException('Invalid sitemap parameters');
    }
    const resources = (await this.repository.listPublicResources()).filter(
      isPubliclyIndexable,
    );
    const slice = resources.slice((part - 1) * chunkSize, part * chunkSize);
    if (slice.length === 0) {
      throw new NotFoundException('Sitemap part not found');
    }
    const urls = slice
      .map((resource) => {
        const metadata = buildSeoMetadata(
          resource,
          this.baseUrl(),
          this.resourcePath(resource),
        );
        return `<url><loc>${escapeXml(metadata.canonicalUrl)}</loc><lastmod>${resource.updatedAt.toISOString()}</lastmod></url>`;
      })
      .join('');
    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
  }

  async sitemapIndex(chunkSize = 50000): Promise<string> {
    const resources = (await this.repository.listPublicResources()).filter(
      isPubliclyIndexable,
    );
    const pages = Math.max(1, Math.ceil(resources.length / chunkSize));
    const base = this.baseUrl();
    const entries = Array.from(
      { length: pages },
      (_, index) =>
        `<sitemap><loc>${escapeXml(`${base}/api/v1/seo/sitemap/${index + 1}.xml`)}</loc></sitemap>`,
    ).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`;
  }

  robots(): string {
    return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /docs\nDisallow: /seo/admin/\nSitemap: ${this.baseUrl()}/api/v1/seo/sitemap-index.xml`;
  }

  private async wouldCycle(
    source: string,
    destination: string,
  ): Promise<boolean> {
    const seen = new Set([source]);
    let cursor = destination;
    for (let i = 0; i < 32; i += 1) {
      if (seen.has(cursor)) return true;
      seen.add(cursor);
      const redirect = await this.repository.getRedirect(cursor);
      if (!redirect) return false;
      cursor = redirect.destination;
    }
    throw new ConflictException('Redirect chain exceeds safety limit');
  }

  private resourcePath(resource: SeoResourceSnapshot): string {
    switch (resource.resourceType) {
      case 'property':
        return `/properties/${encodeURIComponent(resource.slug)}`;
      case 'listing':
        return `/listings/${encodeURIComponent(resource.slug)}`;
      case 'article':
        return `/articles/${encodeURIComponent(resource.slug)}`;
      case 'page':
        return `/pages/${encodeURIComponent(resource.slug)}`;
    }
  }

  private normalizeInternalPath(value: string): string {
    const input = value.trim();
    if (
      !input.startsWith('/') ||
      input.startsWith('//') ||
      /[\r\n]/.test(input)
    ) {
      throw new BadRequestException('Redirect path must be internal');
    }
    const url = new URL(input, this.baseUrl());
    if (
      url.origin !== new URL(this.baseUrl()).origin ||
      url.search ||
      url.hash
    ) {
      throw new BadRequestException(
        'Redirect path must be a clean internal path',
      );
    }
    return url.pathname.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }

  private validateCanonicalUrl(value: string): string {
    try {
      const url = new URL(value);
      if (
        url.origin !== new URL(this.baseUrl()).origin ||
        url.username ||
        url.password
      ) {
        throw new Error();
      }
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      throw new BadRequestException(
        'Canonical URL must use the application origin',
      );
    }
  }

  private validateMetadataInput(
    title?: string | null,
    description?: string | null,
    canonicalUrl?: string | null,
  ): void {
    if (
      title !== undefined &&
      title !== null &&
      normalizeSeoText(title).length > 60
    ) {
      throw new BadRequestException('SEO title exceeds 60 characters');
    }
    if (
      description !== undefined &&
      description !== null &&
      normalizeSeoText(description).length > 160
    ) {
      throw new BadRequestException('SEO description exceeds 160 characters');
    }
    if (canonicalUrl !== undefined && canonicalUrl !== null) {
      this.validateCanonicalUrl(canonicalUrl);
    }
  }

  private baseUrl(): string {
    return this.config
      .getOrThrow<string>('app.publicBaseUrl')
      .replace(/\/$/, '');
  }
}
