export const LISTING_TRANSACTION_TYPES = [
  'SALE',
  'RENT',
  'LEASE',
  'AUCTION',
  'JOINT_VENTURE',
  'OTHER',
] as const;
export type ListingTransactionType = (typeof LISTING_TRANSACTION_TYPES)[number];
export const LISTING_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'VERIFIED',
  'ACTIVE',
  'PUBLISHED',
  'UNPUBLISHED',
  'EXPIRED',
  'SOLD',
  'RENTED',
  'ARCHIVED',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export const LISTING_VISIBILITIES = ['PUBLIC', 'PRIVATE', 'INTERNAL'] as const;
export type ListingVisibility = (typeof LISTING_VISIBILITIES)[number];
export const LISTING_PRICE_TYPES = [
  'TOTAL',
  'PER_MONTH',
  'PER_YEAR',
  'PER_SQM',
  'PER_DAY',
] as const;
export type ListingPriceType = (typeof LISTING_PRICE_TYPES)[number];
export const PAYMENT_OPTION_TYPES = [
  'CASH',
  'MORTGAGE',
  'INSTALLMENT',
  'CASH_OR_MORTGAGE',
  'OTHER',
] as const;
export type PaymentOptionType = (typeof PAYMENT_OPTION_TYPES)[number];
export const PROPERTY_OWNER_TYPES = [
  'INDIVIDUAL',
  'COMPANY',
  'JOINT',
  'GOVERNMENT',
  'OTHER',
] as const;
export type PropertyOwnerType = (typeof PROPERTY_OWNER_TYPES)[number];

export interface ListingPricingInput {
  priceType: ListingPriceType;
  currency: string;
  minPrice?: string | null;
  maxPrice?: string | null;
  pricePerSqm?: string | null;
}
export interface ListingPaymentInput {
  optionType: PaymentOptionType;
  downPaymentAmount?: string | null;
  downPaymentPercent?: string | null;
  installmentAmount?: string | null;
  tenorMonths?: number | null;
  notes?: string | null;
}
export const LISTING_TRANSITIONS: Readonly<
  Record<ListingStatus, readonly ListingStatus[]>
> = {
  DRAFT: ['IN_REVIEW', 'ARCHIVED'],
  IN_REVIEW: ['DRAFT', 'VERIFIED', 'ARCHIVED'],
  VERIFIED: ['ACTIVE', 'IN_REVIEW', 'ARCHIVED'],
  ACTIVE: ['PUBLISHED', 'ARCHIVED', 'SOLD', 'RENTED'],
  PUBLISHED: ['UNPUBLISHED', 'SOLD', 'RENTED', 'EXPIRED', 'ARCHIVED'],
  UNPUBLISHED: ['ACTIVE', 'PUBLISHED', 'ARCHIVED'],
  EXPIRED: ['ACTIVE', 'ARCHIVED'],
  SOLD: ['ARCHIVED'],
  RENTED: ['ARCHIVED'],
  ARCHIVED: ['DRAFT', 'ACTIVE'],
};
const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;
function scaled(value: string, scale: number): bigint {
  const normalized = value.trim();
  if (!DECIMAL_PATTERN.test(normalized))
    throw new Error('Money/percentage must be a non-negative decimal');
  const [whole = '0', fraction = ''] = normalized.split('.');
  if (fraction.length > scale)
    throw new Error(`Decimal scale must not exceed ${scale}`);
  return (
    BigInt(whole) * 10n ** BigInt(scale) +
    BigInt(fraction.padEnd(scale, '0') || '0')
  );
}
export function assertListingTransition(
  from: ListingStatus,
  to: ListingStatus,
): void {
  if (!LISTING_STATUSES.includes(to) || !LISTING_TRANSITIONS[from].includes(to))
    throw new Error(`Invalid listing transition: ${from} -> ${to}`);
}
export function assertPricingInvariants(input: ListingPricingInput): void {
  if (!/^[A-Z]{3}$/.test(input.currency))
    throw new Error('Currency must be a 3-letter ISO-style code');
  const min = input.minPrice == null ? null : scaled(input.minPrice, 2);
  const max = input.maxPrice == null ? null : scaled(input.maxPrice, 2);
  if ((min !== null && min === 0n) || (max !== null && max === 0n))
    throw new Error('Price must be greater than zero');
  if (min !== null && max !== null && min > max)
    throw new Error('Minimum price must not exceed maximum price');
  if (input.pricePerSqm != null && scaled(input.pricePerSqm, 4) === 0n)
    throw new Error('Price per sqm must be greater than zero');
  if (min === null && max === null && input.pricePerSqm == null)
    throw new Error('At least one price representation is required');
}
export function assertPaymentInvariants(input: ListingPaymentInput): void {
  if (
    input.downPaymentAmount != null &&
    scaled(input.downPaymentAmount, 2) < 0n
  )
    throw new Error('Down payment must not be negative');
  if (
    input.installmentAmount != null &&
    scaled(input.installmentAmount, 2) === 0n
  )
    throw new Error('Installment must be greater than zero');
  if (
    input.downPaymentPercent != null &&
    scaled(input.downPaymentPercent, 2) > 10000n
  )
    throw new Error('Down payment percentage must be between 0 and 100');
  if (
    input.tenorMonths != null &&
    (!Number.isInteger(input.tenorMonths) || input.tenorMonths <= 0)
  )
    throw new Error('Tenor must be a positive integer number of months');
  if (
    input.installmentAmount != null &&
    (input.tenorMonths == null || input.tenorMonths <= 0)
  )
    throw new Error('Tenor is required when installment is configured');
}
export function derivePricePerSqm(basePrice: string, areaSqm: string): string {
  const numerator = scaled(basePrice, 2);
  const denominator = scaled(areaSqm, 4);
  if (denominator <= 0n) throw new Error('Area must be greater than zero');
  const scaledResult = (numerator * 10000n) / denominator;
  return `${scaledResult / 10000n}.${(scaledResult % 10000n).toString().padStart(4, '0')}`;
}
export function assertPublishable(input: {
  propertyStatus: string;
  visibility: ListingVisibility;
  hasPrice: boolean;
  hasPrimaryAgent: boolean;
  expiresAt?: Date | null;
  now?: Date;
}): void {
  if (input.propertyStatus !== 'ACTIVE')
    throw new Error('Property must be ACTIVE before publishing a listing');
  if (input.visibility !== 'PUBLIC')
    throw new Error('Published listing must have PUBLIC visibility');
  if (!input.hasPrice)
    throw new Error('Listing price is required before publishing');
  if (!input.hasPrimaryAgent)
    throw new Error('A primary agent is required before publishing');
  const now = input.now ?? new Date();
  if (input.expiresAt != null && input.expiresAt <= now)
    throw new Error('Listing expiry must be in the future');
}
