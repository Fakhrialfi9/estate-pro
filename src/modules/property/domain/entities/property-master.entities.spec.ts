import { describe, expect, it } from 'vitest';
import {
  assertAvailability,
  assertTransition,
  normalizeCode,
  normalizeSlug,
} from '../property-master.types.js';

describe('property master domain rules', () => {
  it('normalizes identifiers', () => {
    expect(normalizeCode(' house sale ')).toBe('HOUSE-SALE');
    expect(normalizeSlug('Luxury House, Bandung!')).toBe(
      'luxury-house-bandung',
    );
  });

  it('allows valid lifecycle transitions and rejects invalid ones', () => {
    expect(() => assertTransition('DRAFT', 'IN_REVIEW')).not.toThrow();
    expect(() => assertTransition('ACTIVE', 'SOLD')).not.toThrow();
    expect(() => assertTransition('SOLD', 'DRAFT')).toThrow(
      'Invalid property status transition',
    );
  });

  it('enforces availability date ordering', () => {
    expect(() =>
      assertAvailability(new Date('2026-08-01'), new Date('2026-08-31')),
    ).not.toThrow();
    expect(() =>
      assertAvailability(new Date('2026-09-01'), new Date('2026-08-31')),
    ).toThrow('availableFrom must not be later than availableTo');
  });
});
