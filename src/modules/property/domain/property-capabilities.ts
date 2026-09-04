export const AMENITY_CATEGORIES = [
  'LIVING',
  'KITCHEN',
  'BATHROOM',
  'OUTDOOR',
  'SECURITY',
  'PARKING',
  'TECHNOLOGY',
  'ACCESSIBILITY',
  'RECREATION',
  'UTILITY',
  'OTHER',
] as const;
export type AmenityCategory = (typeof AMENITY_CATEGORIES)[number];

export const DOCUMENT_CLASSIFICATIONS = [
  'CERTIFICATE',
  'LEGAL',
  'FINANCIAL',
  'SUPPORTING',
  'OTHER',
] as const;
export type DocumentClassification = (typeof DOCUMENT_CLASSIFICATIONS)[number];
export const DOCUMENT_VISIBILITIES = ['PRIVATE', 'RESTRICTED'] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];
export const DOCUMENT_STATUSES = [
  'REGISTERED',
  'ACTIVE',
  'ARCHIVED',
  'DELETED',
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const HISTORY_EVENTS = [
  'CREATED',
  'UPDATED',
  'PRICE_CHANGED',
  'STATUS_CHANGED',
  'LISTING_CHANGED',
  'SEO_CHANGED',
  'MEDIA_CHANGED',
  'AGENT_CHANGED',
] as const;
export type HistoryEvent = (typeof HISTORY_EVENTS)[number];

export type SafeChange = {
  field: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
};

export class PropertyCapabilityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PropertyCapabilityValidationError';
  }
}

export const validateAmenityCode = (value: string): string => {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9_]{2,80}$/.test(normalized)) {
    throw new PropertyCapabilityValidationError(
      'Amenity code must contain only A-Z, 0-9, and underscores',
    );
  }
  return normalized;
};

export const validateDocumentChecksum = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new PropertyCapabilityValidationError(
      'Document checksum must be a SHA-256 hexadecimal value',
    );
  }
  return normalized;
};

export const validateDocumentStorageKey = (value: string): string => {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > 500 ||
    normalized.startsWith('/') ||
    /[\\\r\n]/.test(normalized)
  ) {
    throw new PropertyCapabilityValidationError(
      'Document storage key is invalid',
    );
  }
  return normalized;
};

export const isPropertyHistoryEvent = (value: string): value is HistoryEvent =>
  HISTORY_EVENTS.includes(value as HistoryEvent);
