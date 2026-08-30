import { createHash } from 'node:crypto';
export class PropertyExtrasNotFoundError extends Error {}
export class PropertyExtrasConflictError extends Error {}
export class PropertyExtrasInvalidStateError extends Error {}
export const UTILITY_WATER_SOURCES = [
  'PDAM',
  'WELL',
  'SPRING',
  'RAINWATER',
  'TANKER',
  'OTHER',
  'UNKNOWN',
] as const;
export const UTILITY_GAS_TYPES = [
  'LPG',
  'NATURAL_GAS',
  'PIPED_GAS',
  'NONE',
  'OTHER',
] as const;
export const UTILITY_SEWAGE_TYPES = [
  'SEPTIC_TANK',
  'SEWER',
  'BIOLOGICAL_TREATMENT',
  'NONE',
  'OTHER',
] as const;
export const UTILITY_DRAINAGE_TYPES = [
  'OPEN_DRAIN',
  'CLOSED_DRAIN',
  'SOAKAWAY',
  'STORMWATER',
  'NONE',
  'OTHER',
] as const;
export const UTILITY_DRAINAGE_CONDITIONS = [
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'POOR',
  'UNKNOWN',
] as const;
export const UTILITY_BACKUP_POWER_TYPES = [
  'GENERATOR',
  'BATTERY',
  'UPS',
  'SOLAR_BATTERY',
  'NONE',
  'OTHER',
] as const;
export const LEGAL_OWNERSHIP_TYPES = [
  'INDIVIDUAL',
  'COMPANY',
  'JOINT',
  'GOVERNMENT',
  'FOUNDATION',
  'COOPERATIVE',
  'OTHER',
] as const;
export const LEGAL_OWNERSHIP_STATUSES = [
  'UNKNOWN',
  'PENDING',
  'VERIFIED',
  'DISPUTED',
  'REJECTED',
] as const;
export const LEGAL_VERIFICATION_STATUSES = [
  'UNVERIFIED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
] as const;
export const CERTIFICATE_TYPES = [
  'SHM',
  'HGB',
  'HGU',
  'PBG',
  'IMB',
  'SLF',
  'GIRIK',
  'AJB',
  'PPJB',
  'OTHER',
] as const;
export const CERTIFICATE_STATUSES = [
  'UNKNOWN',
  'PENDING',
  'VALID',
  'EXPIRED',
  'REVOKED',
] as const;
export const INVESTMENT_RATINGS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'NOT_RATED',
] as const;
export const ROBOTS_POLICIES = [
  'INDEX_FOLLOW',
  'NOINDEX_FOLLOW',
  'INDEX_NOFOLLOW',
  'NOINDEX_NOFOLLOW',
] as const;
export const MEDIA_TYPES = [
  'IMAGE',
  'VIDEO',
  'FLOOR_PLAN',
  'VIRTUAL_TOUR',
] as const;
export const MEDIA_CATEGORIES = [
  'EXTERIOR',
  'INTERIOR',
  'BEDROOM',
  'BATHROOM',
  'KITCHEN',
  'LIVING_ROOM',
  'FLOOR_PLAN',
  'LOCATION',
  'AMENITIES',
  'DOCUMENT',
  'VIRTUAL_TOUR',
  'OTHER',
] as const;
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type UtilityPatch = {
  electricityProvider?: string | null;
  electricityCapacityKva?: string | null;
  electricityMeterNumberMasked?: string | null;
  waterSource?: (typeof UTILITY_WATER_SOURCES)[number];
  waterBackupSource?: (typeof UTILITY_WATER_SOURCES)[number] | null;
  gasType?: (typeof UTILITY_GAS_TYPES)[number];
  internetFiber?: boolean;
  internetProviders?: string[] | null;
  sewageType?: (typeof UTILITY_SEWAGE_TYPES)[number];
  drainageType?: (typeof UTILITY_DRAINAGE_TYPES)[number];
  drainageCondition?: (typeof UTILITY_DRAINAGE_CONDITIONS)[number];
  backupPowerType?: (typeof UTILITY_BACKUP_POWER_TYPES)[number];
  backupPowerCapacityKva?: string | null;
};
export type LegalPatch = {
  ownershipType?: (typeof LEGAL_OWNERSHIP_TYPES)[number];
  ownershipStatus?: (typeof LEGAL_OWNERSHIP_STATUSES)[number];
  ownerReference?: string | null;
  verificationStatus?: (typeof LEGAL_VERIFICATION_STATUSES)[number];
  verifiedAt?: string | null;
  verificationSource?: string | null;
  zoningZone?: string | null;
  allowedUse?: string | null;
  buildingCoverageRatio?: string | null;
  floorAreaRatio?: string | null;
  disputes?: JsonValue | null;
  encumbrances?: JsonValue | null;
};
export type CertificateCreateInput = {
  type: (typeof CERTIFICATE_TYPES)[number];
  number: string;
  status?: (typeof CERTIFICATE_STATUSES)[number];
  issueDate?: string | null;
  expiryDate?: string | null;
  issuer?: string | null;
};
export type CertificateUpdateInput = Partial<
  Omit<CertificateCreateInput, 'number'>
> & { number?: string };
export type FinancialPatch = {
  askingPrice?: string | null;
  currency?: string;
  negotiable?: boolean;
  annualPropertyTax?: string | null;
  monthlyMaintenance?: string | null;
  monthlyUtilityCost?: string | null;
  monthlyServiceCharges?: string | null;
  rentalYield?: string | null;
  annualRentalIncome?: string | null;
  capitalGrowth?: string | null;
  investmentRating?: (typeof INVESTMENT_RATINGS)[number];
};
export type FeaturePatch = {
  petFriendly?: boolean;
  childFriendly?: boolean;
  wheelchairAccessible?: boolean;
  elderlyFriendly?: boolean;
  smokingAllowed?: boolean;
  eventsAllowed?: boolean;
  rentalAllowed?: boolean;
};
export type SecurityPatch = {
  securityGuard?: boolean;
  cctv?: boolean;
  accessControl?: boolean;
  gatedCommunity?: boolean;
  smartLock?: boolean;
  alarmSystem?: boolean;
};
export type EnvironmentPatch = {
  greenBuilding?: boolean;
  solarPower?: boolean;
  rainwaterHarvesting?: boolean;
  waterSaving?: boolean;
  greenCertification?: string | null;
};
export type SeoPatch = {
  title?: string | null;
  description?: string | null;
  keywords?: JsonValue | null;
  canonicalUrl?: string | null;
  ogImageUrl?: string | null;
  robots?: (typeof ROBOTS_POLICIES)[number];
  metadataVersion?: string;
  schemaType?: string | null;
  source?: string | null;
  tags?: JsonValue | null;
  customFields?: JsonValue | null;
};
export type MediaCreateInput = {
  type: (typeof MEDIA_TYPES)[number];
  category?: (typeof MEDIA_CATEGORIES)[number];
  url: string;
  thumbnailUrl?: string | null;
  mimeType: string;
  extension?: string | null;
  fileSizeBytes?: number | null;
  widthPx?: number | null;
  heightPx?: number | null;
  durationMs?: number | null;
  sortOrder?: number;
  isCover?: boolean;
  metadata?: JsonValue | null;
  provider?: string | null;
  storageKey?: string | null;
};
export type MediaUpdateInput = Partial<Omit<MediaCreateInput, 'type'>> & {
  type?: (typeof MEDIA_TYPES)[number];
};
export class Money {
  readonly amount: string;
  readonly currency: string;
  constructor(amount: string, currency: string) {
    if (!/^\d{1,18}(?:\.\d{1,2})?$/.test(amount))
      throw new Error(
        'Money amount must be a non-negative decimal with up to 2 fraction digits',
      );
    if (!/^[A-Z]{3}$/.test(currency))
      throw new Error('Money currency must be a 3-letter ISO-style code');
    this.amount = normalizeDecimal(amount);
    this.currency = currency;
  }
  toMinorUnits() {
    const [w = '0', f = ''] = this.amount.split('.');
    return BigInt(w || '0') * 100n + BigInt(f.padEnd(2, '0') || '0');
  }
  round(scale = 2) {
    if (!Number.isInteger(scale) || scale < 0 || scale > 2)
      throw new Error('Unsupported money scale');
    const [w = '0', f = ''] = this.amount.split('.');
    if (f.length <= scale) return new Money(this.amount, this.currency);
    let u =
      BigInt(w || '0') * 10n ** BigInt(scale) +
      BigInt((f.slice(0, scale) || '').padEnd(scale, '0') || '0');
    if ((f[scale] ?? '0') >= '5') u++;
    const d = 10n ** BigInt(scale),
      whole = u / d,
      rem = u % d;
    return new Money(
      scale === 0
        ? whole.toString()
        : `${whole}.${rem.toString().padStart(scale, '0')}`,
      this.currency,
    );
  }
}
export function validateUtilityInvariants(v: UtilityPatch) {
  nonNeg(v.electricityCapacityKva, 'electricityCapacityKva', 8);
  nonNeg(v.backupPowerCapacityKva, 'backupPowerCapacityKva', 8);
  if (
    v.waterSource &&
    v.waterBackupSource &&
    v.waterSource === v.waterBackupSource
  )
    throw new Error('waterBackupSource must differ from waterSource');
  if (
    v.internetFiber === true &&
    (!v.internetProviders || v.internetProviders.length === 0)
  )
    throw new Error(
      'internetProviders is required when internetFiber is enabled',
    );
  if (
    v.backupPowerType &&
    v.backupPowerType !== 'NONE' &&
    v.backupPowerCapacityKva == null
  )
    throw new Error(
      'backupPowerCapacityKva is required for active backup power',
    );
  if (v.backupPowerType === 'NONE' && v.backupPowerCapacityKva != null)
    throw new Error(
      'backupPowerCapacityKva must be empty when backupPowerType is NONE',
    );
  if (
    v.internetProviders &&
    (!v.internetProviders.every((x) => x.trim()) ||
      v.internetProviders.length > 20)
  )
    throw new Error('internetProviders contains invalid values');
}
export function validateLegalInvariants(v: LegalPatch) {
  ratio(v.buildingCoverageRatio, 'buildingCoverageRatio', 100);
  nonNeg(v.floorAreaRatio, 'floorAreaRatio', 4);
  if (v.ownershipStatus === 'VERIFIED' && v.verificationStatus !== 'VERIFIED')
    throw new Error(
      'Verified ownership requires verified legal verification status',
    );
  if (v.verificationStatus === 'VERIFIED' && !v.verifiedAt)
    throw new Error('Verified legal data requires verifiedAt');
  if (v.verificationStatus === 'VERIFIED' && v.ownershipStatus === 'REJECTED')
    throw new Error(
      'Verified legal data cannot have rejected ownership status',
    );
  safe(v.disputes, 'disputes');
  safe(v.encumbrances, 'encumbrances');
}
export function validateCertificateInput(
  v: CertificateCreateInput | CertificateUpdateInput,
) {
  if ('number' in v && v.number !== undefined && !v.number.trim())
    throw new Error('Certificate number must not be empty');
  validateCertificateDates(v.issueDate, v.expiryDate, v.status);
}
export function validateCertificateDates(
  i?: string | null,
  e?: string | null,
  s?: string,
) {
  const a = i ? new Date(i) : undefined,
    b = e ? new Date(e) : undefined;
  if (a && Number.isNaN(a.getTime())) throw new Error('Invalid issueDate');
  if (b && Number.isNaN(b.getTime())) throw new Error('Invalid expiryDate');
  if (a && b && a > b)
    throw new Error('issueDate must be before or equal to expiryDate');
  if (s === 'EXPIRED' && !b)
    throw new Error('EXPIRED certificate requires expiryDate');
}
export function validateFinancialInvariants(v: FinancialPatch) {
  for (const [k, x] of Object.entries(v)) {
    if (['currency', 'negotiable', 'investmentRating'].includes(k) || x == null)
      continue;
    if (typeof x === 'string')
      moneyDecimal(
        x,
        k,
        ['rentalYield', 'capitalGrowth'].includes(k) ? 4 : 2,
        ['rentalYield', 'capitalGrowth'].includes(k) ? 4 : 18,
      );
  }
  if (v.currency !== undefined && !/^[A-Z]{3}$/.test(v.currency))
    throw new Error('currency must be a 3-letter ISO-style code');
}
export function validateSeoInvariants(slug: string, v: SeoPatch) {
  if (v.title != null && (v.title.length < 1 || v.title.length > 60))
    throw new Error('SEO title must be 1-60 characters');
  if (
    v.description != null &&
    (v.description.length < 1 || v.description.length > 160)
  )
    throw new Error('SEO description must be 1-160 characters');
  url(v.canonicalUrl, 'canonicalUrl');
  url(v.ogImageUrl, 'ogImageUrl');
  if (v.canonicalUrl) {
    const u = new URL(v.canonicalUrl);
    if (u.pathname.split('/').filter(Boolean).at(-1) !== slug)
      throw new Error('canonicalUrl must end with the property slug');
  }
  safe(v.keywords, 'keywords');
  safe(v.tags, 'tags');
  safe(v.customFields, 'customFields');
}
export function validateMedia(v: MediaCreateInput | MediaUpdateInput) {
  if (v.url !== undefined) safeMediaUrl(v.url);
  if (v.thumbnailUrl != null) safeMediaUrl(v.thumbnailUrl);
  if (
    v.fileSizeBytes != null &&
    (!Number.isInteger(v.fileSizeBytes) ||
      v.fileSizeBytes < 0 ||
      v.fileSizeBytes > 524288000)
  )
    throw new Error('fileSizeBytes is outside the supported range');
  if (
    v.widthPx != null &&
    (!Number.isInteger(v.widthPx) || v.widthPx < 1 || v.widthPx > 50000)
  )
    throw new Error('widthPx is invalid');
  if (
    v.heightPx != null &&
    (!Number.isInteger(v.heightPx) || v.heightPx < 1 || v.heightPx > 50000)
  )
    throw new Error('heightPx is invalid');
  if (
    v.durationMs != null &&
    (!Number.isInteger(v.durationMs) ||
      v.durationMs < 1 ||
      v.durationMs > 86400000)
  )
    throw new Error('durationMs is invalid');
  if (
    v.sortOrder !== undefined &&
    (!Number.isInteger(v.sortOrder) || v.sortOrder < 0)
  )
    throw new Error('sortOrder must be non-negative');
  const m = v.mimeType?.toLowerCase(),
    t = v.type,
    e = v.extension?.replace(/^\./, '').toLowerCase();
  const im = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  const vm = ['video/mp4', 'video/webm', 'video/quicktime'];
  if (t === 'IMAGE' && m && !im.includes(m))
    throw new Error('Unsupported IMAGE MIME type');
  if (t === 'VIDEO' && m && !vm.includes(m))
    throw new Error('Unsupported VIDEO MIME type');
  if (t === 'FLOOR_PLAN' && m && !(im.includes(m) || m === 'application/pdf'))
    throw new Error('Unsupported FLOOR_PLAN MIME type');
  if (
    t === 'VIRTUAL_TOUR' &&
    m &&
    ![
      'text/html',
      'application/json',
      'application/zip',
      'application/x-zip-compressed',
    ].includes(m)
  )
    throw new Error('Unsupported VIRTUAL_TOUR MIME type');
  if (t === 'IMAGE' && e && !['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(e))
    throw new Error('Invalid IMAGE extension');
  if (t === 'VIDEO' && e && !['mp4', 'webm', 'mov'].includes(e))
    throw new Error('Invalid VIDEO extension');
  if (
    t === 'FLOOR_PLAN' &&
    e &&
    !['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(e)
  )
    throw new Error('Invalid FLOOR_PLAN extension');
  if (t === 'VIRTUAL_TOUR' && e && !['html', 'htm', 'json', 'zip'].includes(e))
    throw new Error('Invalid VIRTUAL_TOUR extension');
  if (t === 'VIDEO' && v.durationMs === null)
    throw new Error('VIDEO durationMs is required');
  if (v.isCover === true && t !== 'IMAGE')
    throw new Error('Only IMAGE media can be a cover');
  safe(v.metadata, 'metadata');
}
export const hashSensitive = (v: string) =>
  createHash('sha256').update(v.trim()).digest('hex');
export const maskSensitive = (v: string, n = 4) => {
  const x = v.trim();
  return x.length <= n
    ? '*'.repeat(x.length)
    : `${'*'.repeat(x.length - n)}${x.slice(-n)}`;
};
const normalizeDecimal = (v: string) => {
  const [w = '0', f = ''] = v.split('.'),
    x = f.replace(/0+$/, '');
  return x ? `${BigInt(w || '0')}.${x}` : BigInt(w || '0').toString();
};
const nonNeg = (v: string | null | undefined, f: string, i = 16) => {
  if (v == null) return;
  if (!new RegExp(`^\\d{1,${i}}(?:\\.\\d{1,4})?$`).test(v))
    throw new Error(`${f} must be a non-negative decimal`);
};
const moneyDecimal = (v: string, f: string, s: number, i: number) => {
  if (!new RegExp(`^\\d{1,${i}}(?:\\.\\d{1,${s}})?$`).test(v))
    throw new Error(`${f} must be a non-negative decimal`);
};
const ratio = (v: string | null | undefined, f: string, max: number) => {
  if (v == null) return;
  if (!/^\d{1,3}(?:\.\d{1,4})?$/.test(v) || Number(v) > max)
    throw new Error(`${f} must be <= ${max}`);
};
const url = (v: string | null | undefined, f: string) => {
  if (v == null) return;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    throw new Error(`${f} must be a valid URL`);
  }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password)
    throw new Error(`${f} must be an http(s) URL without credentials`);
};
const safeMediaUrl = (v: string) => {
  url(v, 'media URL');
  const h = new URL(v).hostname.toLowerCase();
  if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(h))
    throw new Error('media URL cannot target localhost');
  const o = h.split('.').map(Number);
  if (o.length === 4 && o.every(Number.isInteger)) {
    const [a, b = 0] = o;
    if (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    )
      throw new Error('media URL cannot target private network addresses');
  }
};
export function assertSafeJson(
  v: JsonValue | null | undefined,
  f: string,
  d = 0,
) {
  safe(v, f, d);
}
const safe = (v: JsonValue | null | undefined, f: string, d = 0) => {
  if (v == null) return;
  if (d > 5) throw new Error(`${f} exceeds maximum JSON depth`);
  if (typeof v === 'string') {
    if (v.length > 2000) throw new Error(`${f} contains an oversized string`);
    return;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return;
  if (Array.isArray(v)) {
    if (v.length > 100) throw new Error(`${f} contains too many array items`);
    v.forEach((x) => safe(x, f, d + 1));
    return;
  }
  const e = Object.entries(v);
  if (e.length > 50) throw new Error(`${f} contains too many keys`);
  for (const [k, x] of e) {
    if (['__proto__', 'prototype', 'constructor'].includes(k))
      throw new Error(`${f} contains a forbidden key`);
    safe(x, f, d + 1);
  }
};
