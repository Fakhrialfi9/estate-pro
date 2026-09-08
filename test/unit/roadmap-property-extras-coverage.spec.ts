import { describe, expect, it } from 'vitest';

import {
  Money,
  validateCertificateDates,
  validateCertificateInput,
  validateFinancialInvariants,
  validateLegalInvariants,
  validateMedia,
  validateSeoInvariants,
  validateUtilityInvariants,
} from '../../src/modules/property/domain/property-extras.js';

describe('property extras coverage', () => {
  it('covers Money validation, minor units and rounding branches', () => {
    const money = new Money('12.30', 'IDR');
    expect(money.amount).toBe('12.3');
    expect(money.currency).toBe('IDR');
    expect(money.toMinorUnits()).toBe(1230n);
    expect(new Money('12', 'IDR').round(2).amount).toBe('12');
    expect(new Money('12.345', 'IDR' as never)).toThrow;
    expect(() => new Money('12.345', 'IDR')).toThrow();
    expect(() => new Money('12', 'idr')).toThrow('Money currency must be a 3-letter ISO-style code');
    expect(() => money.round(-1)).toThrow('Unsupported money scale');
    expect(() => money.round(3)).toThrow('Unsupported money scale');
    expect(new Money('1.005' as never, 'IDR' as never)).toThrow;
    expect(new Money('1.25', 'IDR').round(1).amount).toBe('1.3');
    expect(new Money('1.24', 'IDR').round(1).amount).toBe('1.2');
    expect(new Money('99.99', 'IDR').round(0).amount).toBe('100');
  });

  it('covers utility invariants and boundary failures', () => {
    expect(() => validateUtilityInvariants({})).not.toThrow();
    expect(() => validateUtilityInvariants({ waterSource: 'PDAM', waterBackupSource: 'PDAM' })).toThrow('waterBackupSource must differ');
    expect(() => validateUtilityInvariants({ internetFiber: true })).toThrow('internetProviders is required');
    expect(() => validateUtilityInvariants({ backupPowerType: 'GENERATOR' })).toThrow('backupPowerCapacityKva is required');
    expect(() => validateUtilityInvariants({ backupPowerType: 'NONE', backupPowerCapacityKva: '1' })).toThrow('backupPowerCapacityKva must be empty');
    expect(() => validateUtilityInvariants({ internetProviders: ['ok', '   '] })).toThrow('invalid values');
    expect(() => validateUtilityInvariants({ internetProviders: Array.from({ length: 21 }, () => 'provider') })).toThrow('invalid values');
    expect(() => validateUtilityInvariants({ electricityCapacityKva: '-1' })).toThrow();
    expect(() => validateUtilityInvariants({ electricityCapacityKva: '999999999' })).toThrow();
    expect(() => validateUtilityInvariants({ backupPowerCapacityKva: '999999999' })).toThrow();
  });

  it('covers legal and certificate validation rules', () => {
    expect(() => validateLegalInvariants({ buildingCoverageRatio: '80', floorAreaRatio: '2' })).not.toThrow();
    expect(() => validateLegalInvariants({ ownershipStatus: 'VERIFIED', verificationStatus: 'PENDING' })).toThrow('Verified ownership');
    expect(() => validateLegalInvariants({ verificationStatus: 'VERIFIED' })).toThrow('verifiedAt');
    expect(() => validateLegalInvariants({ verificationStatus: 'VERIFIED', verifiedAt: '2026-01-01', ownershipStatus: 'REJECTED' })).toThrow('rejected ownership');
    expect(() => validateLegalInvariants({ buildingCoverageRatio: '101' })).toThrow();
    expect(() => validateLegalInvariants({ floorAreaRatio: '-1' })).toThrow();
    expect(() => validateLegalInvariants({ disputes: () => 'nope' as never })).toThrow();
    expect(() => validateCertificateInput({ type: 'SHM', number: ' ' })).toThrow('Certificate number');
    expect(() => validateCertificateInput({ type: 'SHM', number: 'ABC', issueDate: 'bad' })).toThrow('Invalid issueDate');
    expect(() => validateCertificateDates('2026-02-01', 'bad')).toThrow('Invalid expiryDate');
    expect(() => validateCertificateDates('2026-02-02', '2026-02-01')).toThrow('issueDate must be before');
    expect(() => validateCertificateDates(undefined, undefined, 'EXPIRED')).toThrow('EXPIRED certificate requires expiryDate');
    expect(() => validateCertificateDates('2026-02-01', '2026-02-01')).not.toThrow();
  });

  it('covers financial, SEO and media invariant branches', () => {
    expect(() => validateFinancialInvariants({ askingPrice: '100.00', rentalYield: '3.50', capitalGrowth: '2.25', currency: 'IDR' })).not.toThrow();
    expect(() => validateFinancialInvariants({ askingPrice: '-1' })).toThrow();
    expect(() => validateFinancialInvariants({ rentalYield: '12345' })).toThrow();
    expect(() => validateFinancialInvariants({ currency: 'idr' })).toThrow('currency must be a 3-letter');
    expect(() => validateSeoInvariants('villa-bali', { title: 'Villa Bali', description: 'A description', canonicalUrl: 'https://example.com/villa-bali' })).not.toThrow();
    expect(() => validateSeoInvariants('villa-bali', { title: 'x'.repeat(61) })).toThrow('SEO title');
    expect(() => validateSeoInvariants('villa-bali', { description: 'x'.repeat(161) })).toThrow('SEO description');
    expect(() => validateSeoInvariants('villa-bali', { canonicalUrl: 'http://example.com/villa-bali' })).toThrow();
    expect(() => validateSeoInvariants('villa-bali', { canonicalUrl: 'https://example.com/other' })).toThrow('canonicalUrl must end');
    expect(() => validateSeoInvariants('villa-bali', { canonicalUrl: 'javascript:alert(1)' as never })).toThrow();

    expect(() => validateMedia({ type: 'IMAGE', url: 'https://cdn.example.com/a.jpg', mimeType: 'image/jpeg', extension: '.jpg' })).not.toThrow();
    expect(() => validateMedia({ type: 'IMAGE', url: 'http://cdn.example.com/a.jpg', mimeType: 'image/jpeg' })).toThrow();
    expect(() => validateMedia({ type: 'IMAGE', url: 'https://cdn.example.com/a.jpg', mimeType: 'image/jpeg', fileSizeBytes: -1 })).toThrow('fileSizeBytes');
    expect(() => validateMedia({ type: 'IMAGE', url: 'https://cdn.example.com/a.jpg', mimeType: 'image/jpeg', widthPx: 0 })).toThrow('widthPx');
    expect(() => validateMedia({ type: 'VIDEO', url: 'https://cdn.example.com/a.mp4', mimeType: 'video/mp4', durationMs: 0 })).toThrow('durationMs');
    expect(() => validateMedia({ type: 'IMAGE', url: 'https://cdn.example.com/a.jpg', mimeType: 'image/jpeg', sortOrder: -1 })).toThrow('sortOrder');
  });
});
