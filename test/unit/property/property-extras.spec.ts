import { describe, expect, it } from 'vitest';
import {
  Money,
  assertSafeJson,
  maskSensitive,
  validateCertificateDates,
  validateMedia,
  validateSeoInvariants,
  validateUtilityInvariants,
} from '../../../src/modules/property/domain/property-extras.js';

describe('property extras domain', () => {
  it('preserves money precision without floating point', () => {
    const m = new Money('100000000000000000.50', 'IDR');
    expect(m.toMinorUnits()).toBe(10000000000000000050n);
    expect(m.round(2).amount).toBe('100000000000000000.5');
  });
  it('rejects invalid utility combinations', () => {
    expect(() => validateUtilityInvariants({ internetFiber: true })).toThrow(
      'internetProviders',
    );
    expect(() =>
      validateUtilityInvariants({
        waterSource: 'PDAM',
        waterBackupSource: 'PDAM',
      }),
    ).toThrow('waterBackupSource');
    expect(() =>
      validateUtilityInvariants({ backupPowerType: 'GENERATOR' }),
    ).toThrow('backupPowerCapacityKva');
  });
  it('validates certificate dates and masks sensitive identifiers', () => {
    expect(() => validateCertificateDates('2026-04-10', '2026-04-01')).toThrow(
      'before',
    );
    expect(() =>
      validateCertificateDates(undefined, undefined, 'EXPIRED'),
    ).toThrow('expiryDate');
    expect(maskSensitive('CERT-123456')).toBe('*******3456');
  });
  it('enforces media security invariants', () => {
    expect(() =>
      validateMedia({
        type: 'VIDEO',
        url: 'https://cdn.example.test/a.mp4',
        mimeType: 'video/mp4',
        durationMs: null,
      }),
    ).toThrow('duration');
    expect(() =>
      validateMedia({
        type: 'IMAGE',
        url: 'http://127.0.0.1/a.jpg',
        mimeType: 'image/jpeg',
      }),
    ).toThrow('localhost');
    expect(() =>
      validateMedia({
        type: 'VIDEO',
        url: 'https://cdn.example.test/a.mp4',
        mimeType: 'image/jpeg',
        durationMs: 1000,
      }),
    ).toThrow('VIDEO MIME');
    expect(() =>
      validateMedia({
        type: 'VIDEO',
        url: 'https://cdn.example.test/a.mp4',
        mimeType: 'video/mp4',
        durationMs: 1000,
        isCover: true,
      }),
    ).toThrow('IMAGE');
  });
  it('enforces canonical slug and safe JSON boundaries', () => {
    expect(() =>
      validateSeoInvariants('villa-jakarta', {
        canonicalUrl: 'https://estate.test/properties/other',
      }),
    ).toThrow('property slug');
    expect(() => assertSafeJson({ constructor: 'x' }, 'customFields')).toThrow(
      'forbidden',
    );
  });
});
