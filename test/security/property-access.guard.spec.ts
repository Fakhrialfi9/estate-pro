import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { PropertyAccessGuard } from '../../src/common/security/property-access.guard.js';
import type { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';

const PROPERTY_UUID = '11111111-1111-4111-8111-111111111111';
const LISTING_UUID = '22222222-2222-4222-8222-222222222222';
const USER_UUID = '33333333-3333-4333-8333-333333333333';
const OTHER_UUID = '44444444-4444-4444-8444-444444444444';

type TestRequest = {
  user?: { sub?: string; permissions?: readonly string[] };
  params: Record<string, string | undefined>;
  route?: { path?: string };
  path?: string;
};

const contextOf = (request: TestRequest) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as never;

describe('PropertyAccessGuard', () => {
  const findProperty = vi.fn<() => Promise<{ id: number } | null>>();
  const findListing = vi.fn<() => Promise<{ id: number } | null>>();
  const prisma = {
    property: { findFirst: findProperty },
    propertyListing: { findFirst: findListing },
  } as unknown as PrismaService;
  const guard = new PropertyAccessGuard(prisma);

  it('fails closed when the request has no principal', async () => {
    await expect(
      guard.canActivate(
        contextOf({
          params: { uuid: PROPERTY_UUID },
          route: { path: '/property/properties/:uuid' },
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('does not add an object lookup to unrelated authorized routes', async () => {
    const result = await guard.canActivate(
      contextOf({
        user: { sub: USER_UUID, permissions: ['permissions.read'] },
        params: {},
        route: { path: '/permissions' },
      }),
    );
    expect(result).toBe(true);
    expect(findProperty).not.toHaveBeenCalled();
    expect(findListing).not.toHaveBeenCalled();
  });

  it('allows explicit global property management permission', async () => {
    const result = await guard.canActivate(
      contextOf({
        user: { sub: USER_UUID, permissions: ['properties.manage'] },
        params: { uuid: OTHER_UUID },
        route: { path: '/property/properties/:uuid' },
      }),
    );
    expect(result).toBe(true);
    expect(findProperty).not.toHaveBeenCalled();
  });

  it('allows the property creator', async () => {
    findProperty.mockResolvedValueOnce({ id: 1 });
    const result = await guard.canActivate(
      contextOf({
        user: { sub: USER_UUID, permissions: ['properties.read'] },
        params: { uuid: PROPERTY_UUID },
        route: { path: '/property/properties/:uuid' },
      }),
    );
    expect(result).toBe(true);
    expect(findProperty).toHaveBeenCalledWith(
      expect.objectContaining<Record<string, unknown>>({
        where: expect.objectContaining<Record<string, unknown>>({
          uuid: PROPERTY_UUID,
          deletedAt: null,
          OR: expect.arrayContaining<{ createdBy: string }>([
            { createdBy: USER_UUID },
          ]),
        }),
      }),
    );
  });

  it('allows an actively assigned agent', async () => {
    findProperty.mockResolvedValueOnce({ id: 2 });
    const result = await guard.canActivate(
      contextOf({
        user: { sub: USER_UUID, permissions: ['properties.update'] },
        params: { propertyUuid: PROPERTY_UUID, roomUuid: OTHER_UUID },
        route: { path: '/property/properties/:propertyUuid/rooms/:roomUuid' },
      }),
    );
    expect(result).toBe(true);
  });

  it('denies a user accessing another user property', async () => {
    findProperty.mockResolvedValueOnce(null);
    await expect(
      guard.canActivate(
        contextOf({
          user: { sub: OTHER_UUID, permissions: ['properties.read'] },
          params: { uuid: PROPERTY_UUID },
          route: { path: '/property/properties/:uuid' },
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('protects listing object access by resolving the owning property', async () => {
    findListing.mockResolvedValueOnce(null);
    await expect(
      guard.canActivate(
        contextOf({
          user: { sub: OTHER_UUID, permissions: ['listings.read'] },
          params: { uuid: LISTING_UUID },
          route: { path: '/property/listings/:uuid' },
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(findListing).toHaveBeenCalledWith(
      expect.objectContaining<Record<string, unknown>>({
        where: expect.objectContaining<Record<string, unknown>>({
          uuid: LISTING_UUID,
          property: expect.objectContaining<Record<string, unknown>>({
            deletedAt: null,
            OR: expect.arrayContaining<{ createdBy: string }>([
              { createdBy: OTHER_UUID },
            ]),
          }),
        }),
      }),
    );
  });

  it('allows a listing when its property belongs to the principal', async () => {
    findListing.mockResolvedValueOnce({ id: 10 });
    await expect(
      guard.canActivate(
        contextOf({
          user: { sub: USER_UUID, permissions: ['listings.read'] },
          params: { uuid: LISTING_UUID },
          route: { path: '/property/listings/:uuid' },
        }),
      ),
    ).resolves.toBe(true);
  });
});
