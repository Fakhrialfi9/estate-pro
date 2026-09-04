import { describe, expect, it } from 'vitest';
import {
  HISTORY_EVENTS,
  validateAmenityCode,
  validateDocumentChecksum,
  validateDocumentStorageKey,
} from '../../src/modules/property/domain/property-capabilities.js';

describe('Property capability policies', () => {
  it('normalizes valid amenity codes', () => {
    expect(validateAmenityCode('  swimming_pool ')).toBe('SWIMMING_POOL');
  });

  it('rejects unsafe amenity codes', () => {
    expect(() => validateAmenityCode('POOL-<SCRIPT>')).toThrow();
  });

  it('accepts only SHA-256 hexadecimal checksums', () => {
    expect(validateDocumentChecksum('A'.repeat(64))).toBe('a'.repeat(64));
    expect(() => validateDocumentChecksum('abc')).toThrow();
  });

  it('rejects absolute or newline-containing storage keys', () => {
    expect(validateDocumentStorageKey('properties/a.pdf')).toBe('properties/a.pdf');
    expect(() => validateDocumentStorageKey('/properties/a.pdf')).toThrow();
    expect(() => validateDocumentStorageKey('properties/a.pdf\n')).toThrow();
  });

  it('keeps history event vocabulary finite and typed', () => {
    expect(HISTORY_EVENTS).toContain('PRICE_CHANGED');
    expect(HISTORY_EVENTS).not.toContain('ARBITRARY_EVENT');
  });
});
