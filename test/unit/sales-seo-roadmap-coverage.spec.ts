import { describe, expect, it } from 'vitest';

import {
  calculateCommission,
  calculateForecastAmount,
  dealTransitionAllowed,
  negotiationTransitionAllowed,
  offerTransitionAllowed,
  parseMoney,
  transitionAllowed,
  viewingTransitionAllowed,
} from '../../src/modules/sales/domain/sales.types.js';
import {
  buildCanonicalUrl,
  buildSeoMetadata,
  isPubliclyIndexable,
  normalizeKeywords,
} from '../../src/modules/seo/domain/seo.policy.js';
import type { SeoResourceSnapshot } from '../../src/modules/seo/domain/seo.types.js';

const resource = (
  seo: SeoResourceSnapshot['seo'] = {},
): SeoResourceSnapshot => ({
  resourceType: 'article',
  uuid: '00000000-0000-4000-8000-000000000001',
  slug: 'article',
  title: '  Article Title  ',
  description: null,
  language: 'id',
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  publishedAt: new Date('2026-08-01T00:00:00Z'),
  published: true,
  seo,
});

describe('sales and SEO roadmap coverage', () => {
  it('covers money, commission and forecast boundaries', () => {
    expect(parseMoney('10')).toBe(10);
    expect(parseMoney('10.1250')).toBe(10.125);
    expect(calculateCommission('1000', '5')).toBe('50.0000');
    expect(calculateCommission('1000', '0')).toBe('0.0000');
    expect(calculateForecastAmount('1000', 0)).toBe('0.0000');
    expect(calculateForecastAmount('1000', 100)).toBe('1000.0000');

    expect(() => parseMoney('-1')).toThrow();
    expect(() => parseMoney('1.12345')).toThrow();
    expect(() => calculateCommission('1000', '100.0001')).toThrow();
    expect(() => calculateForecastAmount('1000', -1)).toThrow();
    expect(() => calculateForecastAmount('1000', 101)).toThrow();
    expect(() => calculateForecastAmount('1000', 1.5)).toThrow();
  });

  it('covers every sales transition family and unknown-state fallback', () => {
    expect(transitionAllowed('OPEN', 'QUALIFIED')).toBe(true);
    expect(transitionAllowed('OPEN', 'WON')).toBe(false);
    expect(transitionAllowed('UNKNOWN', 'OPEN')).toBe(false);
    expect(viewingTransitionAllowed('REQUESTED', 'CONFIRMED')).toBe(true);
    expect(viewingTransitionAllowed('REQUESTED', 'COMPLETED')).toBe(false);
    expect(viewingTransitionAllowed('UNKNOWN', 'CONFIRMED')).toBe(false);
    expect(negotiationTransitionAllowed('ACTIVE', 'ACCEPTED')).toBe(true);
    expect(negotiationTransitionAllowed('CLOSED', 'OPEN')).toBe(false);
    expect(negotiationTransitionAllowed('UNKNOWN', 'OPEN')).toBe(false);
    expect(offerTransitionAllowed('SUBMITTED', 'EXPIRED')).toBe(true);
    expect(offerTransitionAllowed('ACCEPTED', 'REJECTED')).toBe(false);
    expect(offerTransitionAllowed('UNKNOWN', 'DRAFT')).toBe(false);
    expect(dealTransitionAllowed('READY_TO_CLOSE', 'CLOSED')).toBe(true);
    expect(dealTransitionAllowed('CLOSED', 'OPEN')).toBe(false);
    expect(dealTransitionAllowed('UNKNOWN', 'OPEN')).toBe(false);
  });

  it('covers SEO canonical, keyword and metadata fallback branches', () => {
    expect(normalizeKeywords('foo, bar, foo')).toEqual(['foo', 'bar']);
    expect(normalizeKeywords({ value: 'ignored' })).toEqual([]);
    expect(normalizeKeywords([' foo ', 1, '', 'bar'])).toEqual(['foo', 'bar']);
    expect(() =>
      buildCanonicalUrl('https://example.com', 'properties/a'),
    ).toThrow();
    expect(() =>
      buildCanonicalUrl('https://example.com', '//evil.example/a'),
    ).toThrow();

    const base = resource();
    const metadata = buildSeoMetadata(
      base,
      'https://example.com',
      '/articles/article',
    );
    expect(metadata.description).toBe('Article Title');
    expect(metadata.openGraph.type).toBe('article');
    expect(metadata.twitter.card).toBe('summary');

    const rich = resource({
      title: ' SEO Title ',
      description: ' SEO Description ',
      canonicalUrl: 'https://example.com/articles/article?x=1#fragment',
      robots: 'index,nofollow',
      openGraph: {
        title: ' OG Title ',
        description: ' OG Description ',
        imageUrl: 'https://cdn.example/image.jpg',
      },
      twitter: {
        title: ' Twitter Title ',
        description: ' Twitter Description ',
      },
      metadataVersion: '2.0',
    });
    const richMetadata = buildSeoMetadata(
      rich,
      'https://example.com',
      '/articles/article',
    );
    expect(richMetadata.title).toBe('SEO Title');
    expect(richMetadata.description).toBe('SEO Description');
    expect(richMetadata.canonicalUrl).toBe(
      'https://example.com/articles/article',
    );
    expect(richMetadata.robots).toBe('index,nofollow');
    expect(richMetadata.twitter.card).toBe('summary_large_image');
    expect(richMetadata.metadataVersion).toBe('2.0');

    const unsafeStored = resource({
      canonicalUrl: 'https://evil.example/article',
      robots: 'unknown',
    });
    const normalizedUnsafe = buildSeoMetadata(
      unsafeStored,
      'https://example.com',
      '/articles/article',
    );
    expect(normalizedUnsafe.canonicalUrl).toBe(
      'https://example.com/articles/article',
    );
    expect(normalizedUnsafe.robots).toBe('index,follow');

    expect(isPubliclyIndexable(resource())).toBe(true);
    expect(isPubliclyIndexable(resource({ robots: 'noindex,follow' }))).toBe(
      false,
    );
    expect(isPubliclyIndexable(resource({ robots: 'noindex,nofollow' }))).toBe(
      false,
    );
    expect(isPubliclyIndexable(resource({ published: false }))).toBe(false);
  });
});
