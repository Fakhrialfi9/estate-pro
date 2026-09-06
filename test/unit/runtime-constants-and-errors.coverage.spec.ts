import { describe, expect, it } from 'vitest';

import {
  ContentConcurrencyError,
  ContentConflictError,
  ContentNotFoundError,
  ContentValidationError,
} from '../../src/modules/content/application/content.errors.js';
import {
  INDEXABLE_ROBOTS,
  NON_INDEXABLE_ROBOTS,
} from '../../src/modules/seo/domain/seo.types.js';

describe('runtime constants and errors coverage', () => {
  it('covers content error constructors', () => {
    const errors = [
      new ContentNotFoundError('missing'),
      new ContentConflictError('conflict'),
      new ContentValidationError('invalid'),
      new ContentConcurrencyError(),
    ];

    expect(errors.map((error) => error.name)).toEqual([
      'ContentNotFoundError',
      'ContentConflictError',
      'ContentValidationError',
      'ContentConcurrencyError',
    ]);
    expect(errors.map((error) => error.message)).toEqual([
      'missing',
      'conflict',
      'invalid',
      'The resource was modified by another request',
    ]);
    expect(new ContentConcurrencyError('custom').message).toBe('custom');
  });

  it('covers SEO robot constants', () => {
    expect(INDEXABLE_ROBOTS).toBe('index,follow');
    expect(NON_INDEXABLE_ROBOTS).toBe('noindex,nofollow');
  });
});
