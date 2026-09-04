import { buildCanonicalUrl, buildSeoMetadata, isPubliclyIndexable, normalizeKeywords, normalizeSeoText, robotsFromIndexability } from '../../src/modules/seo/domain/seo.policy.js';
import type { SeoResourceSnapshot } from '../../src/modules/seo/domain/seo.types.js';

const resource = (overrides: Partial<SeoResourceSnapshot> = {}): SeoResourceSnapshot => ({
  resourceType: 'property',
  uuid: '00000000-0000-4000-8000-000000000001',
  slug: 'rumah-jakarta',
  title: '  Rumah   Jakarta  ',
  description: '  Rumah nyaman  ',
  language: 'id',
  updatedAt: new Date('2026-09-04T00:00:00.000Z'),
  publishedAt: new Date('2026-09-03T00:00:00.000Z'),
  published: true,
  seo: {},
  ...overrides,
});

describe('SEO policy', () => {
  it('normalizes whitespace', () => {
    expect(normalizeSeoText('  alpha   beta ')).toBe('alpha beta');
  });

  it('normalizes and deduplicates keywords', () => {
    expect(normalizeKeywords([' Foo ', 'foo', 'bar'])).toEqual(['Foo', 'foo', 'bar']);
  });

  it('builds only same-origin canonical URLs', () => {
    expect(buildCanonicalUrl('https://example.com', '/properties/a?x=1#hash')).toBe('https://example.com/properties/a');
    expect(() => buildCanonicalUrl('https://example.com', '//evil.example/a')).toThrow();
  });

  it('maps indexability to robots', () => {
    expect(robotsFromIndexability(true)).toBe('index,follow');
    expect(robotsFromIndexability(false)).toBe('noindex,nofollow');
  });

  it('excludes unpublished resources from sitemap eligibility', () => {
    expect(isPubliclyIndexable(resource())).toBe(true);
    expect(isPubliclyIndexable(resource({ published: false }))).toBe(false);
    expect(isPubliclyIndexable(resource({ seo: { robots: 'noindex,follow' } }))).toBe(false);
  });

  it('builds deterministic metadata from the source resource', () => {
    const metadata = buildSeoMetadata(resource(), 'https://example.com', '/properties/rumah-jakarta');
    expect(metadata.title).toBe('Rumah Jakarta');
    expect(metadata.description).toBe('Rumah nyaman');
    expect(metadata.canonicalUrl).toBe('https://example.com/properties/rumah-jakarta');
    expect(metadata.robots).toBe('index,follow');
  });
});
