import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PropertyExtrasConflictError,
  PropertyExtrasInvalidStateError,
  PropertyExtrasNotFoundError,
} from '../../src/modules/property/domain/property-extras.js';
import * as rules from '../../src/modules/property/domain/property-extras.js';
import { PropertyExtrasService } from '../../src/modules/property/application/property-extras.service.js';

const actor = {
  actorUuid: 'actor-1',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
  requestId: 'req-1',
};

const validMedia = {
  type: 'IMAGE',
  category: 'INTERIOR',
  url: 'https://example.com/image.jpg',
  mimeType: 'image/jpeg',
  isCover: false,
};

const depsFactory = () => ({
  repository: {
    getUtilities: vi.fn().mockResolvedValue({ electricityProvider: 'PLN' }),
    upsertUtilities: vi.fn().mockResolvedValue({ ok: true }),
    getLegal: vi.fn().mockResolvedValue({ ownershipType: 'COMPANY' }),
    upsertLegal: vi.fn().mockResolvedValue({ ok: true }),
    listCertificates: vi.fn().mockResolvedValue([{ uuid: 'cert-1' }]),
    createCertificate: vi.fn().mockResolvedValue({ uuid: 'cert-1' }),
    updateCertificate: vi.fn().mockResolvedValue({ uuid: 'cert-1' }),
    deleteCertificate: vi.fn().mockResolvedValue(undefined),
    getFinancial: vi.fn().mockResolvedValue({ askingPrice: '100000' }),
    upsertFinancial: vi.fn().mockResolvedValue({ ok: true }),
    getFeatures: vi.fn().mockResolvedValue({ petFriendly: true }),
    upsertFeatures: vi.fn().mockResolvedValue({ ok: true }),
    getSecurity: vi.fn().mockResolvedValue({ cctv: true }),
    upsertSecurity: vi.fn().mockResolvedValue({ ok: true }),
    getEnvironment: vi.fn().mockResolvedValue({ solarPower: true }),
    upsertEnvironment: vi.fn().mockResolvedValue({ ok: true }),
    getSeo: vi.fn().mockResolvedValue({ title: 'Title' }),
    getPropertySlug: vi.fn().mockResolvedValue('grand-residence'),
    upsertSeo: vi.fn().mockResolvedValue({ ok: true }),
    listMedia: vi.fn().mockResolvedValue([{ uuid: 'media-1' }]),
    addMedia: vi.fn().mockResolvedValue({ uuid: 'media-1' }),
    updateMedia: vi.fn().mockResolvedValue({ uuid: 'media-1' }),
    deleteMedia: vi.fn().mockResolvedValue(undefined),
    setCover: vi.fn().mockResolvedValue({
      uuid: 'media-1',
      isCover: true,
    }),
    reorderMedia: vi.fn().mockResolvedValue([{ uuid: 'media-1' }]),
  },
  audit: { record: vi.fn().mockResolvedValue(undefined) },
});

describe('PropertyExtrasService coverage', () => {
  let d: ReturnType<typeof depsFactory>;
  let service: PropertyExtrasService;

  beforeEach(() => {
    d = depsFactory();
    service = new PropertyExtrasService(
      d.repository as never,
      d.audit as never,
    );
  });

  it('covers utility, legal and certificate CRUD', async () => {
    await expect(service.getUtilities('p1')).resolves.toEqual({
      electricityProvider: 'PLN',
    });
    await expect(
      service.updateUtilities(
        'p1',
        {
          waterSource: 'PDAM',
          internetFiber: true,
          internetProviders: ['ISP'],
        } as never,
        actor,
      ),
    ).resolves.toEqual({ ok: true });
    await expect(service.getLegal('p1')).resolves.toEqual({
      ownershipType: 'COMPANY',
    });
    await expect(
      service.updateLegal(
        'p1',
        {
          ownerReference: 'SECRET',
          disputes: { open: true },
          encumbrances: { x: true },
        } as never,
        actor,
      ),
    ).resolves.toEqual({ ok: true });
    await expect(service.listCertificates('p1')).resolves.toEqual([
      { uuid: 'cert-1' },
    ]);
    await expect(
      service.createCertificate(
        'p1',
        { type: 'SHM', number: '123', status: 'VALID' },
        actor,
      ),
    ).resolves.toEqual({ uuid: 'cert-1' });
    await expect(
      service.updateCertificate(
        'p1',
        'cert-1',
        { number: '456', type: 'HGB', status: 'VALID' },
        actor,
      ),
    ).resolves.toEqual({ uuid: 'cert-1' });
    await expect(
      service.deleteCertificate('p1', 'cert-1', actor),
    ).resolves.toBeUndefined();
    expect(d.audit.record).toHaveBeenCalled();
  });

  it('covers financial, feature, security and environment flows', async () => {
    await expect(service.getFinancial('p1')).resolves.toEqual({
      askingPrice: '100000',
    });
    await expect(
      service.updateFinancial(
        'p1',
        { askingPrice: '100000', currency: 'IDR' } as never,
        actor,
      ),
    ).resolves.toEqual({ ok: true });
    await expect(service.getFeatures('p1')).resolves.toEqual({
      petFriendly: true,
    });
    await expect(
      service.updateFeatures('p1', { petFriendly: true } as never, actor),
    ).resolves.toEqual({ ok: true });
    await expect(service.getSecurity('p1')).resolves.toEqual({
      cctv: true,
    });
    await expect(
      service.updateSecurity('p1', { cctv: true } as never, actor),
    ).resolves.toEqual({ ok: true });
    await expect(service.getEnvironment('p1')).resolves.toEqual({
      solarPower: true,
    });
    await expect(
      service.updateEnvironment('p1', { solarPower: true } as never, actor),
    ).resolves.toEqual({ ok: true });
  });

  it('covers SEO and media lifecycle', async () => {
    await expect(service.getSeo('p1')).resolves.toEqual({ title: 'Title' });
    await expect(
      service.updateSeo(
        'p1',
        {
          title: 'A good title',
          canonicalUrl: 'https://example.com/grand-residence',
        } as never,
        actor,
      ),
    ).resolves.toEqual({ ok: true });
    await expect(service.listMedia('p1')).resolves.toEqual([
      { uuid: 'media-1' },
    ]);
    await expect(
      service.addMedia('p1', validMedia as never, actor),
    ).resolves.toEqual({ uuid: 'media-1' });
    await expect(
      service.updateMedia(
        'p1',
        'media-1',
        {
          category: 'EXTERIOR',
          mimeType: 'image/jpeg',
          url: 'https://example.com/x.jpg',
        } as never,
        actor,
      ),
    ).resolves.toEqual({ uuid: 'media-1' });
    await expect(
      service.deleteMedia('p1', 'media-1', actor),
    ).resolves.toBeUndefined();
    await expect(service.setCover('p1', 'media-1', actor)).resolves.toEqual({
      uuid: 'media-1',
      isCover: true,
    });
    await expect(
      service.reorderMedia('p1', ['media-1'], actor),
    ).resolves.toEqual([{ uuid: 'media-1' }]);
    await expect(
      service.reorderMedia('p1', ['media-1', 'media-1'], actor),
    ).rejects.toThrow('mediaUuids must not contain duplicates');
  });

  it('maps repository domain errors and preserves unexpected errors', async () => {
    d.repository.getUtilities.mockRejectedValueOnce(
      new PropertyExtrasNotFoundError('property missing'),
    );
    await expect(service.getUtilities('p1')).rejects.toThrow(
      'property missing',
    );
    d.repository.getUtilities.mockRejectedValueOnce(
      new PropertyExtrasConflictError('conflict'),
    );
    await expect(service.getUtilities('p1')).rejects.toThrow('conflict');
    d.repository.getUtilities.mockRejectedValueOnce(
      new PropertyExtrasInvalidStateError('bad state'),
    );
    await expect(service.getUtilities('p1')).rejects.toThrow('bad state');
    const unexpected = new Error('unexpected');
    d.repository.getUtilities.mockRejectedValueOnce(unexpected);
    await expect(service.getUtilities('p1')).rejects.toBe(unexpected);
  });

  it('covers domain validation failure paths', () => {
    expect(() =>
      rules.validateUtilityInvariants({
        waterSource: 'PDAM',
        waterBackupSource: 'PDAM',
      }),
    ).toThrow();
    expect(() =>
      rules.validateUtilityInvariants({
        internetFiber: true,
        internetProviders: [],
      }),
    ).toThrow();
    expect(() =>
      rules.validateUtilityInvariants({ backupPowerType: 'GENERATOR' }),
    ).toThrow();
    expect(() =>
      rules.validateLegalInvariants({
        ownershipStatus: 'VERIFIED',
        verificationStatus: 'PENDING',
      }),
    ).toThrow();
    expect(() => rules.validateLegalInvariants({ verificationStatus: 'VERIFIED' })).toThrow();
    expect(() => rules.validateCertificateInput({ number: ' ' } as never)).toThrow();
    expect(() => rules.validateCertificateDates('bad')).toThrow('Invalid issueDate');
    expect(() => rules.validateCertificateDates(undefined, 'bad')).toThrow('Invalid expiryDate');
    expect(() => rules.validateCertificateDates('2026-02-01', '2026-01-01')).toThrow();
    expect(() => rules.validateCertificateDates(undefined, undefined, 'EXPIRED')).toThrow();
    expect(() => rules.validateFinancialInvariants({ currency: 'id' })).toThrow();
    expect(() => rules.validateSeoInvariants('slug', { title: 'x'.repeat(61) })).toThrow();
    expect(() => rules.validateSeoInvariants('slug', { canonicalUrl: 'https://example.com/other' })).toThrow();
    expect(() => rules.validateMedia({ ...validMedia, fileSizeBytes: -1 } as never)).toThrow();
    expect(() => rules.validateMedia({ ...validMedia, widthPx: 0 } as never)).toThrow();
    expect(() => rules.validateMedia({ ...validMedia, heightPx: 0 } as never)).toThrow();
    expect(() => rules.validateMedia({ ...validMedia, durationMs: 0 } as never)).toThrow();
    expect(() => rules.validateMedia({ ...validMedia, sortOrder: -1 } as never)).toThrow();
  });

  it('covers money arithmetic and invalid inputs', () => {
    const money = new rules.Money('12.30', 'IDR');
    expect(money.amount).toBe('12.30');
    expect(money.currency).toBe('IDR');
    expect(money.toMinorUnits()).toBe(1230n);
    expect(money.round(2).amount).toBe('12.30');
    expect(() => new rules.Money('12.345', 'IDR')).toThrow();
    expect(() => new rules.Money('x', 'IDR')).toThrow();
    expect(() => new rules.Money('10', 'id')).toThrow();
    expect(() => money.round(3)).toThrow();
  });
});
