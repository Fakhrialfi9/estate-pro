export type PropertyDetailsActor = {
  readonly actorUuid?: string | undefined;
  readonly ipAddress?: string | undefined;
  readonly userAgent?: string | undefined;
  readonly requestId?: string | undefined;
};

export const ORIENTATIONS = [
  'NORTH',
  'NORTHEAST',
  'EAST',
  'SOUTHEAST',
  'SOUTH',
  'SOUTHWEST',
  'WEST',
  'NORTHWEST',
  'UNKNOWN',
] as const;
export type PropertyOrientation = (typeof ORIENTATIONS)[number];
export const CONDITIONS = [
  'NEW',
  'GOOD',
  'FAIR',
  'NEEDS_RENOVATION',
  'RENOVATED',
] as const;
export type PropertyCondition = (typeof CONDITIONS)[number];
export const FURNISHED_STATUSES = [
  'UNFURNISHED',
  'SEMI_FURNISHED',
  'FULLY_FURNISHED',
] as const;
export type FurnishedStatus = (typeof FURNISHED_STATUSES)[number];
export const PARKING_TYPES = [
  'NONE',
  'CARPORT',
  'GARAGE',
  'OPEN_PARKING',
  'STREET_PARKING',
  'MIXED',
] as const;
