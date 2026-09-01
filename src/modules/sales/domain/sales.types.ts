export const OPPORTUNITY_STATUSES = [
  'OPEN',
  'QUALIFIED',
  'NEGOTIATING',
  'WON',
  'LOST',
  'ARCHIVED',
] as const;

export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const VIEWING_STATUSES = [
  'REQUESTED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export type ViewingStatus = (typeof VIEWING_STATUSES)[number];

export const NEGOTIATION_STATUSES = [
  'OPEN',
  'ACTIVE',
  'ACCEPTED',
  'REJECTED',
  'CLOSED',
] as const;

export type NegotiationStatus = (typeof NEGOTIATION_STATUSES)[number];

export const OFFER_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
] as const;

export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const DEAL_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'READY_TO_CLOSE',
  'CLOSED',
  'LOST',
  'CANCELLED',
] as const;

export type DealStatus = (typeof DEAL_STATUSES)[number];

export const ACTIVITY_STATUSES = ['OPEN', 'COMPLETED', 'CANCELLED'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const ACTIVITY_TYPES = ['CALL', 'EMAIL', 'NOTE', 'TASK'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export interface SalesActor {
  readonly actorUuid: string;
  readonly permissions: readonly string[];
  readonly requestId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const parseScaled = (value: string): bigint => {
  if (!/^\d+(?:\.\d{1,4})?$/.test(value)) {
    throw new Error(
      'Money must be a non-negative decimal with up to 4 fractional digits',
    );
  }

  const [whole, fractional = ''] = value.split('.');
  return BigInt(whole) * 10000n + BigInt((fractional + '0000').slice(0, 4));
};

const formatScaled = (value: bigint): string => {
  const whole = value / 10000n;
  const fraction = (value % 10000n).toString().padStart(4, '0');
  return `${whole.toString()}.${fraction}`;
};

export const parseMoney = (value: string): number =>
  Number(formatScaled(parseScaled(value)));

export const calculateCommission = (
  baseAmount: string,
  ratePercent: string,
): string => {
  const base = parseScaled(baseAmount);
  const rate = parseScaled(ratePercent);

  if (rate < 0n || rate > 1000000n) {
    throw new Error('Commission rate must be between 0 and 100');
  }

  return formatScaled((base * rate) / 1000000n);
};

export const calculateForecastAmount = (
  amount: string,
  probabilityPercent: number,
): string => {
  if (
    !Number.isInteger(probabilityPercent) ||
    probabilityPercent < 0 ||
    probabilityPercent > 100
  ) {
    throw new Error('Probability must be 0..100');
  }

  return formatScaled(
    (parseScaled(amount) * BigInt(probabilityPercent)) / 100n,
  );
};

const OPPORTUNITY_TRANSITIONS: Record<string, readonly string[]> = {
  OPEN: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['NEGOTIATING', 'LOST'],
  NEGOTIATING: ['WON', 'LOST'],
  WON: ['ARCHIVED'],
  LOST: ['OPEN', 'ARCHIVED'],
  ARCHIVED: [],
};

export const transitionAllowed = (from: string, to: string): boolean =>
  OPPORTUNITY_TRANSITIONS[from]?.includes(to) ?? false;

export const viewingTransitionAllowed = (from: string, to: string): boolean =>
  (
    ({
      REQUESTED: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: [],
    }) satisfies Record<string, readonly string[]>
  )[from]?.includes(to) ?? false;

export const negotiationTransitionAllowed = (
  from: string,
  to: string,
): boolean =>
  (
    ({
      OPEN: ['ACTIVE', 'REJECTED', 'CLOSED'],
      ACTIVE: ['ACCEPTED', 'REJECTED', 'CLOSED'],
      ACCEPTED: ['CLOSED'],
      REJECTED: ['CLOSED'],
      CLOSED: [],
    }) satisfies Record<string, readonly string[]>
  )[from]?.includes(to) ?? false;

export const offerTransitionAllowed = (from: string, to: string): boolean =>
  (
    ({
      DRAFT: ['SUBMITTED', 'REJECTED'],
      SUBMITTED: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
      ACCEPTED: [],
      REJECTED: [],
      EXPIRED: [],
    }) satisfies Record<string, readonly string[]>
  )[from]?.includes(to) ?? false;

export const dealTransitionAllowed = (from: string, to: string): boolean =>
  (
    ({
      OPEN: ['IN_PROGRESS', 'READY_TO_CLOSE', 'LOST', 'CANCELLED'],
      IN_PROGRESS: ['READY_TO_CLOSE', 'LOST', 'CANCELLED'],
      READY_TO_CLOSE: ['CLOSED', 'LOST'],
      CLOSED: [],
      LOST: [],
      CANCELLED: [],
    }) satisfies Record<string, readonly string[]>
  )[from]?.includes(to) ?? false;
