import { describe, expect, it, vi } from 'vitest';
import { ListingService } from './listing.service.js';
import {
  ListingConflictError,
  ListingNotFoundError,
} from '../infrastructure/listing.repository.js';
import type { ListingRepository } from '../domain/listing.repository.js';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';

const actor = { actorUuid: '4d8c9c16-4dfd-4dc8-a51f-9c1f2bca0a18' };
const input = {
  propertyUuid: 'c4f5d3bf-9f51-4fc2-8c60-5b6e3c27bbd7',
  listingCode: 'LST-001',
  transactionType: 'SALE' as const,
  price: {
    priceType: 'TOTAL' as const,
    currency: 'IDR',
    minPrice: '1000000.00',
  },
};

describe('ListingService', () => {
  it('coordinates creation and audit', async () => {
    const create = vi.fn().mockResolvedValue({ uuid: 'listing-uuid' });
    const record = vi.fn().mockResolvedValue(undefined);
    const repository = { create } as unknown as ListingRepository;
    const audit = { record } as unknown as SecurityAuditRepository;
    const service = new ListingService(repository, audit);
    await expect(service.create(input, actor)).resolves.toEqual({
      uuid: 'listing-uuid',
    });
    expect(create).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledOnce();
  });

  it('maps repository not-found and version conflicts to HTTP errors', async () => {
    const findOne = vi.fn().mockRejectedValue(new ListingNotFoundError('missing'));
    const update = vi.fn().mockRejectedValue(new ListingConflictError('conflict'));
    const repository = { findOne, update } as unknown as ListingRepository;
    const record = vi.fn();
    const audit = { record } as unknown as SecurityAuditRepository;
    const service = new ListingService(repository, audit);
    await expect(service.get('missing')).rejects.toMatchObject({ status: 404 });
    await expect(service.update('listing', 1, {}, actor)).rejects.toMatchObject(
      { status: 409 },
    );
  });

  it('writes workflow audit after a successful transition', async () => {
    const transition = vi
      .fn()
      .mockResolvedValue({ status: 'IN_REVIEW' });
    const record = vi.fn().mockResolvedValue(undefined);
    const repository = { transition } as unknown as ListingRepository;
    const audit = { record } as unknown as SecurityAuditRepository;
    const service = new ListingService(repository, audit);
    await service.transition('listing', 1, 'IN_REVIEW', actor);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'property.listing.in_review',
        result: 'SUCCESS',
      }),
    );
  });
});
