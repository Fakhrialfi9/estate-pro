import { describe, expect, it } from 'vitest';
import {
  ArticleEntity,
  RevisionEntity,
} from '../../src/modules/content/domain/entities/content.entities.js';
import {
  normalizeSlug,
  sanitizeHtml,
  sanitizeJson,
} from '../../src/modules/content/application/content.service.js';

describe('content domain', () => {
  it('normalizes slugs deterministically', () => {
    expect(normalizeSlug('  Hello, Déjà Vu!  ')).toBe('hello-deja-vu');
  });

  it('rejects empty slugs', () => {
    expect(() => normalizeSlug('---')).toThrow();
  });

  it('sanitizes executable HTML and dangerous URLs', () => {
    const html =
      '<script>alert(1)</script><p onclick="alert(1)">safe <a href="javascript:alert(1)">x</a></p>';
    const sanitized = sanitizeHtml(html);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).toContain('<p>');
  });

  it('sanitizes nested content and enforces depth limits', () => {
    expect(sanitizeJson({ body: '<img src=x onerror=alert(1)>' })).toEqual({
      body: '',
    });
    let value: unknown = 'x';
    for (let index = 0; index < 12; index += 1) value = { value };
    expect(() => sanitizeJson(value)).toThrow(/too deep/i);
  });

  it('enforces article lifecycle transitions', () => {
    const entity = new ArticleEntity(
      '00000000-0000-4000-8000-000000000001',
      'Title',
      'title',
      'body',
    );
    entity.transition('IN_REVIEW');
    entity.transition('APPROVED');
    entity.transition('PUBLISHED');
    expect(entity.status).toBe('PUBLISHED');
    expect(() => entity.transition('IN_REVIEW')).toThrow(
      /Invalid article transition/,
    );
  });

  it('keeps revisions immutable', () => {
    const revision = new RevisionEntity(
      'article',
      '00000000-0000-4000-8000-000000000001',
      1,
      { title: 'x' },
      new Date(),
    );
    expect(() => Object.assign(revision, { version: 2 })).toThrow();
    expect(revision.version).toBe(1);
  });
});
