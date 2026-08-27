import { describe, expect, it } from 'vitest';
import {
  assertCoordinatePair,
  assertLocationHierarchy,
  assertPoolInvariants,
  assertRoomInvariants,
  assertSpecificationInvariants,
} from '../../src/modules/property/domain/property-details.js';

describe('property detail domain invariants', () => {
  it('accepts zero-valued non-negative specification counters', () => {
    expect(() =>
      assertSpecificationInvariants({
        bedrooms: 0,
        maidRooms: 0,
        guestToilets: 0,
        parkingSpaces: 0,
        livingRooms: 0,
        familyRooms: 0,
        diningRooms: 0,
        kitchens: 0,
      }),
    ).not.toThrow();
  });

  it('rejects negative bedrooms', () => {
    expect(() => assertSpecificationInvariants({ bedrooms: -1 })).toThrow();
  });

  it('rejects negative bathrooms', () => {
    expect(() => assertSpecificationInvariants({ bathrooms: '-1' })).toThrow();
  });

  it('rejects negative maidRooms', () => {
    expect(() => assertSpecificationInvariants({ maidRooms: -1 })).toThrow();
  });

  it('rejects negative guestToilets', () => {
    expect(() =>
      assertSpecificationInvariants({ guestToilets: -1 }),
    ).toThrow();
  });

  it('rejects negative parkingSpaces', () => {
    expect(() =>
      assertSpecificationInvariants({ parkingSpaces: -1 }),
    ).toThrow();
  });

  it('requires a positive floor count', () => {
    expect(() => assertSpecificationInvariants({ floors: 0 })).toThrow();
  });

  it('rejects renovation before construction', () => {
    expect(() =>
      assertSpecificationInvariants({ yearBuilt: 2020, yearRenovated: 2019 }),
    ).toThrow();
  });

  it('rejects building area greater than land area', () => {
    expect(() =>
      assertSpecificationInvariants({
        landArea: '100',
        buildingArea: '101',
      }),
    ).toThrow('buildingArea must not exceed landArea');
  });

  it('keeps parking representation internally consistent', () => {
    expect(() =>
      assertSpecificationInvariants({ parkingType: 'NONE', parkingSpaces: 1 }),
    ).toThrow('parkingSpaces must be zero');
  });

  it('validates coordinate pairing and ranges', () => {
    expect(() => assertCoordinatePair('1.23456789', '110')).toThrow();
    expect(() => assertCoordinatePair('1', '181')).toThrow();
    expect(() => assertCoordinatePair('1.234567', '110.1234567')).not.toThrow();
    expect(() => assertCoordinatePair('1', undefined)).toThrow(
      'must be provided together',
    );
  });

  it('rejects gaps in geographic hierarchy', () => {
    expect(() =>
      assertLocationHierarchy(['country', undefined, 'city']),
    ).toThrow();
  });

  it('enforces pool dimension invariants', () => {
    expect(() =>
      assertPoolInvariants({
        hasPool: false,
        poolLengthM: '1',
      }),
    ).toThrow();
    expect(() =>
      assertPoolInvariants({
        hasPool: true,
        poolLengthM: '0',
        poolWidthM: '4',
        poolDepthM: '1',
      }),
    ).toThrow();
  });

  it('enforces room floor and area invariants', () => {
    expect(() => assertRoomInvariants({ floor: 1, area: '12.00' })).not.toThrow();
    expect(() => assertRoomInvariants({ floor: 1.5, area: '12' })).toThrow();
    expect(() => assertRoomInvariants({ floor: 1, area: '0' })).toThrow();
  });
});
