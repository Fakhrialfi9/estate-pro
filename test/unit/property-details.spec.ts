import { describe, expect, it } from 'vitest';
import {
  assertCoordinatePair,
  assertLocationHierarchy,
  assertPoolInvariants,
  assertRoomInvariants,
  assertSpecificationInvariants,
  PropertyDetailInvalidStateError,
} from '../../src/modules/property/domain/property-details.js';

describe('property detail domain invariants', () => {
  it('accepts zero-valued non-negative specification counters', () => {
    expect(() =>
      assertSpecificationInvariants({
        bedrooms: 0,
        bathrooms: '0',
        maidRooms: 0,
        guestToilets: 0,
        floors: 1,
        parkingType: 'NONE',
        parkingSpaces: 0,
      }),
    ).not.toThrow();
  });

  it.each([
    ['bedrooms', { bedrooms: -1 }],
    ['bathrooms', { bathrooms: '-0.01' }],
    ['maidRooms', { maidRooms: -1 }],
    ['guestToilets', { guestToilets: -1 }],
    ['parkingSpaces', { parkingSpaces: -1 }],
  ])('rejects negative %s', (_, input) => {
    expect(() => assertSpecificationInvariants(input)).toThrow(
      PropertyDetailInvalidStateError,
    );
  });

  it('requires a positive floor count', () => {
    expect(() => assertSpecificationInvariants({ floors: 0 })).toThrow(
      'floors must be greater than zero',
    );
  });

  it('rejects renovation before construction', () => {
    expect(() =>
      assertSpecificationInvariants({ yearBuilt: 2020, yearRenovated: 2019 }),
    ).toThrow('yearRenovated must be greater than or equal to yearBuilt');
  });

  it('rejects building area greater than land area', () => {
    expect(() =>
      assertSpecificationInvariants({
        landArea: '100',
        buildingArea: '100.01',
      }),
    ).toThrow('buildingArea must not exceed landArea');
  });

  it('keeps parking representation internally consistent', () => {
    expect(() =>
      assertSpecificationInvariants({ parkingType: 'NONE', parkingSpaces: 1 }),
    ).toThrow('parkingSpaces must be zero');
  });

  it('validates coordinate pairing and ranges', () => {
    expect(() => assertCoordinatePair('1.2345678', '110')).toThrow();
    expect(() => assertCoordinatePair('1', '181')).toThrow();
    expect(() => assertCoordinatePair('1.234567', '110.1234567')).not.toThrow();
    expect(() => assertCoordinatePair('1', undefined)).toThrow(
      'must be provided together',
    );
  });

  it('rejects gaps in geographic hierarchy', () => {
    expect(() =>
      assertLocationHierarchy([
        'country',
        undefined,
        'city',
        undefined,
        undefined,
      ]),
    ).toThrow('cannot be supplied');
    expect(() =>
      assertLocationHierarchy([
        'country',
        'province',
        'city',
        'district',
        'subdistrict',
      ]),
    ).not.toThrow();
  });

  it('enforces pool dimension invariants', () => {
    expect(() =>
      assertPoolInvariants({ hasPool: false, poolLengthM: '10' }),
    ).toThrow('only valid when hasPool is true');
    expect(() =>
      assertPoolInvariants({
        hasPool: true,
        poolLengthM: '10',
        poolWidthM: '4',
        poolDepthM: '0',
      }),
    ).toThrow('must be greater than zero');
    expect(() =>
      assertPoolInvariants({
        hasPool: true,
        poolLengthM: '10',
        poolWidthM: '4',
        poolDepthM: '1.5',
      }),
    ).not.toThrow();
  });

  it('enforces room floor and area invariants', () => {
    expect(() => assertRoomInvariants({ floor: 1, area: '0' })).toThrow(
      'area must be greater than zero',
    );
    expect(() => assertRoomInvariants({ floor: 1.5, area: '10' })).toThrow(
      'floor must be an integer',
    );
    expect(() => assertRoomInvariants({ floor: -1, area: '10' })).not.toThrow();
  });
});
