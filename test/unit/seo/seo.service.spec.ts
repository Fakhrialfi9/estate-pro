import type { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SeoService } from '../../../src/modules/seo/application/seo.service.js';

const resource = (overrides: Record<string, unknown> = {}) => ({
  resourceType: 'article' as const,
  uuid: 'article-1',
  slug: 'hello-world',
  title: 'Hello World',
  description: 'A useful article',
  content: 'Content',
  published: true,
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  publishedAt: new Date('2025-12-01T00:00:00.000Z'),
  seo: { title: '', description: '', robots: 'index,follow' },
  ...overrides,
});

function createService() {
  const repository = {
    getPublicResource: vi.fn(),
    upsertPropertyMetadata: vi.fn(),
    upsertContentMetadata: vi.fn(),
    getRedirect: vi.fn(),
    listRedirects: vi.fn(),
    upsertRedirect: vi.fn(),
    deactivateRedirect: vi.fn(),
  };
  const sitemapQuery = { page: vi.fn(), count: vi.fn() };
  const propertyPublic = { getPublicProperty: vi.fn() };
  const config = {
    getOrThrow: vi.fn().mockReturnValue('https://estate.example/'),
  } as unknown as ConfigService;
  return {
    service: new SeoService(
      repository as never,
      sitemapQuery,
      propertyPublic,
      config,
    ),
    repository,
    sitemapQuery,
    propertyPublic,
  };
}

describe('SeoService', () => {
  it('returns public resource metadata and rejects missing or non-indexable resources', async () => {
    const { service, repository } = createService();
    repository.getPublicResource.mockResolvedValue(resource());
    const result = await service.getPublicResource('article', 'hello-world');
    expect(result.resource.uuid).toBe('article-1');
    expect(result.metadata.canonicalUrl).toBe(
      'https://estate.example/articles/hello-world',
    );

    repository.getPublicResource.mockResolvedValueOnce(null);
    await expect(
      service.getPublicResource('article', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
    repository.getPublicResource.mockResolvedValueOnce(
      resource({ seo: { robots: 'noindex,follow' } }),
    );
    await expect(
      service.getPublicResource('article', 'hidden'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('builds structured data for property and content resource types', async () => {
    const { service, propertyPublic, repository } = createService();
    propertyPublic.getPublicProperty.mockResolvedValue({
      uuid: 'property-1',
      slug: 'villa',
      title: 'Villa',
      description: 'A villa',
      canonicalUrl: null,
      listingType: 'SALE',
      price: 100,
      currency: 'USD',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      publishedAt: new Date('2025-12-01T00:00:00.000Z'),
      location: { city: 'Bandung', country: 'ID' },
      images: [],
      amenities: [],
      availabilityStatus: 'AVAILABLE',
    });
    expect(
      await service.getPublicStructuredData('property', 'villa'),
    ).toMatchObject({ '@type': 'RealEstateListing' });
    propertyPublic.getPublicProperty.mockResolvedValue(null);
    await expect(
      service.getPublicStructuredData('property', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);

    for (const [type, expected] of [
      ['article', 'Article'],
      ['listing', 'Offer'],
      ['page', 'WebPage'],
    ] as const) {
      repository.getPublicResource.mockResolvedValue(
        resource({ resourceType: type }),
      );
      expect(await service.getPublicStructuredData(type, 'item')).toMatchObject(
        { '@type': expected },
      );
    }
  });

  it('normalizes and validates metadata before persisting it', async () => {
    const { service, repository } = createService();
    repository.upsertPropertyMetadata.mockResolvedValue({ uuid: 'seo-1' });
    await service.updatePropertyMetadata(
      'property-1',
      {
        title: '  Villa  ',
        description: '  Description  ',
        canonicalUrl: 'https://estate.example/properties/villa?x=1#top',
      },
      'actor-1',
    );
    expect(repository.upsertPropertyMetadata).toHaveBeenCalledWith(
      'property-1',
      expect.objectContaining({
        title: 'Villa',
        description: 'Description',
        canonicalUrl: 'https://estate.example/properties/villa',
      }),
      'actor-1',
    );
    await expect(
      service.updatePropertyMetadata('p', { title: 'x'.repeat(61) }, 'a'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateContentMetadata(
        'article',
        'a',
        { canonicalUrl: 'https://other.example/x' },
        'actor',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('handles redirects, including cycles and unsafe paths', async () => {
    const { service, repository } = createService();
    repository.getRedirect.mockResolvedValue(null);
    repository.upsertRedirect.mockResolvedValue({
      sourcePath: '/old',
      destination: '/new',
    });
    await expect(
      service.createRedirect({
        sourcePath: ' /old/ ',
        destination: '/new/',
        statusCode: 301,
        actorUuid: 'a',
      }),
    ).resolves.toEqual({ sourcePath: '/old', destination: '/new' });
    await expect(
      service.createRedirect({
        sourcePath: '/same',
        destination: '/same',
        statusCode: 301,
        actorUuid: 'a',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.createRedirect({
        sourcePath: '/a',
        destination: '/b?x=1',
        statusCode: 301,
        actorUuid: 'a',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    repository.getRedirect.mockResolvedValue({ destination: '/a' });
    await expect(
      service.createRedirect({
        sourcePath: '/a',
        destination: '/b',
        statusCode: 301,
        actorUuid: 'a',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await service.resolveRedirect(' /old/ ')).toEqual({
      destination: '/a',
    });
  });

  it('renders sitemap chunks and indexes with validation and XML escaping', async () => {
    const { service, sitemapQuery } = createService();
    sitemapQuery.page.mockResolvedValue([
      { loc: 'https://estate.example/a?x=1&y=2', lastmod: '2026-01-01' },
    ]);
    const xml = await service.sitemapChunk(1, 10);
    expect(xml).toContain('&amp;');
    await expect(service.sitemapChunk(0)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    sitemapQuery.page.mockResolvedValue([]);
    await expect(service.sitemapChunk(2)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    sitemapQuery.count.mockResolvedValue(100001);
    expect(await service.sitemapIndex(50000)).toContain('/sitemap/3.xml');
    sitemapQuery.count.mockResolvedValue(0);
    expect(await service.sitemapIndex()).toContain('<sitemapindex');
    expect(service.robots()).toContain(
      'Sitemap: https://estate.example/api/v1/seo/sitemap-index.xml',
    );
  });
});
