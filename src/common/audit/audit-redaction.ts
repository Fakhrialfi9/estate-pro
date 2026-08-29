const MAX_STRING_LENGTH = 512;
const SENSITIVE_FIELD_PATTERN =
  /(password|passphrase|token|jwt|secret|otp|totp|recovery|credential|authorization|cookie|sessionsecret|encryption|privatekey|apikey|database)/i;

const ALLOWED_FIELDS: Record<string, ReadonlySet<string>> = {
  AuthenticationUser: new Set([
    'username',
    'email',
    'phone',
    'status',
    'isActive',
  ]),
  user: new Set(['username', 'email', 'phone', 'status', 'isActive']),
  AuthorizationRole: new Set(['name', 'description', 'isActive']),
  role: new Set(['name', 'description', 'isActive']),
  AuthorizationPermission: new Set(['name']),
  permission: new Set(['name']),
  AuthorizationRolePermission: new Set(['permission']),
  role_permission: new Set(['permission']),
  user_role: new Set(['targetUserUuid', 'roleUuid']),
  property: new Set([
    'businessCode',
    'referenceNumber',
    'code',
    'name',
    'title',
    'slug',
    'description',
    'shortDescription',
    'status',
    'availabilityStatus',
    'availableFrom',
    'availableTo',
    'isActive',
    'sortOrder',
  ]),
  property_type: new Set([
    'code',
    'name',
    'slug',
    'description',
    'icon',
    'isActive',
    'sortOrder',
  ]),
  property_specification: new Set([
    'landArea',
    'buildingArea',
    'floorArea',
    'bedrooms',
    'bathrooms',
    'maidRooms',
    'guestToilets',
    'floors',
    'parkingType',
    'parkingSpaces',
    'livingRooms',
    'familyRooms',
    'diningRooms',
    'kitchens',
    'yearBuilt',
    'yearRenovated',
    'orientation',
    'condition',
    'furnishedStatus',
    'ceilingHeightM',
    'frontageM',
    'roadWidthM',
  ]),
  property_location: new Set([
    'countryUuid',
    'provinceUuid',
    'cityUuid',
    'districtUuid',
    'subdistrictUuid',
    'addressLine',
    'street',
    'building',
    'block',
    'unit',
    'neighborhood',
    'postalCode',
    'latitude',
    'longitude',
    'coordinateAccuracy',
    'mapProvider',
    'placeId',
    'mapUrl',
    'floodRisk',
    'earthquakeRisk',
    'trafficRisk',
    'noiseRisk',
    'airQualityRisk',
  ]),
  property_building: new Set([
    'foundation',
    'structure',
    'walls',
    'roof',
    'flooring',
    'doors',
    'windows',
    'facade',
    'garden',
    'terrace',
    'balcony',
    'rooftop',
    'hasPool',
    'poolLengthM',
    'poolWidthM',
    'poolDepthM',
    'interiorStyle',
    'interiorDesign',
    'naturalLighting',
    'ventilation',
    'smartHome',
    'soundproofing',
  ]),
  property_room: new Set([
    'roomType',
    'name',
    'floor',
    'area',
    'hasBathroom',
    'hasWalkInCloset',
    'hasBalcony',
    'hasAirConditioning',
    'sortOrder',
  ]),
  property_facility: new Set([
    'facilityUuid',
    'available',
    'quantity',
    'notes',
    'count',
  ]),
  property_listing: new Set([
    'listingCode',
    'transactionType',
    'status',
    'visibility',
    'featured',
    'premium',
    'version',
  ]),
  property_utilities: new Set([
    'electricityProvider',
    'electricityCapacityKva',
    'waterSource',
    'waterBackupSource',
    'gasType',
    'internetFiber',
    'sewageType',
    'drainageType',
    'drainageCondition',
    'backupPowerType',
    'backupPowerCapacityKva',
  ]),
  property_legal: new Set([
    'ownershipType',
    'ownershipStatus',
    'verificationStatus',
    'verificationSource',
    'zoningZone',
    'allowedUse',
    'buildingCoverageRatio',
    'floorAreaRatio',
  ]),
  property_certificate: new Set(['type', 'status', 'numberChanged']),
  property_financial: new Set([
    'currency',
    'negotiable',
    'investmentRating',
    'askingPrice',
    'annualPropertyTax',
    'monthlyMaintenance',
    'monthlyUtilityCost',
    'monthlyServiceCharges',
    'rentalYield',
    'annualRentalIncome',
    'capitalGrowth',
  ]),
  property_features: new Set([
    'petFriendly',
    'childFriendly',
    'wheelchairAccessible',
    'elderlyFriendly',
    'smokingAllowed',
    'eventsAllowed',
    'rentalAllowed',
  ]),
  property_security: new Set([
    'securityGuard',
    'cctv',
    'accessControl',
    'gatedCommunity',
    'smartLock',
    'alarmSystem',
  ]),
  property_environment: new Set([
    'greenBuilding',
    'solarPower',
    'rainwaterHarvesting',
    'waterSaving',
    'greenCertification',
  ]),
  property_seo: new Set([
    'title',
    'description',
    'robots',
    'metadataVersion',
    'schemaType',
    'source',
  ]),
  property_media: new Set([
    'type',
    'category',
    'sortOrder',
    'isCover',
    'provider',
  ]),
  property_agent_assignment: new Set([
    'agentUserUuid',
    'isPrimary',
    'assignedAt',
    'unassignedAt',
  ]),
  property_owner: new Set(['ownerType']),
  AuthenticationSession: new Set(['reason']),
  session: new Set(['reason']),
  two_factor: new Set(['enabled', 'reason']),
  authentication: new Set(['reason']),
};

export const normalizeAuditResourceType = (value?: string): string | null => {
  if (!value) return null;
  const normalized = value.trim();
  const aliases: Record<string, string> = {
    Authentication: 'authentication',
    AuthenticationUser: 'user',
    AuthenticationUserProfile: 'profile',
    AuthenticationUserCredential: 'credential',
    AuthenticationUserSession: 'session',
    AuthenticationUserTwoFactor: 'two_factor',
    AuthenticationUserTwoFactorRecoveryCode: 'recovery_code',
    AuthorizationRole: 'role',
    AuthorizationPermission: 'permission',
    AuthorizationRolePermission: 'role_permission',
    AuditLog: 'audit_log',
  };
  return (
    aliases[normalized] ??
    normalized
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 100)
  );
};

const sanitizeScalar = (value: unknown): string | boolean | number | null => {
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  return null;
};

export const sanitizeAuditChanges = (
  resourceType: string,
  changes: readonly {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[] = [],
) => {
  const allowlist = ALLOWED_FIELDS[resourceType] ?? new Set<string>();
  return changes.flatMap((change) => {
    if (
      !change.field ||
      SENSITIVE_FIELD_PATTERN.test(change.field) ||
      (allowlist.size > 0 && !allowlist.has(change.field))
    ) {
      return [];
    }
    return [
      {
        field: change.field.slice(0, 100),
        oldValue: sanitizeScalar(change.oldValue),
        newValue: sanitizeScalar(change.newValue),
      },
    ];
  });
};

export const sanitizeAuditReason = (reason?: string): string | null => {
  if (!reason) return null;
  const normalized = reason.trim().slice(0, 100);
  if (!normalized) return null;
  if (/^[A-Z][A-Z0-9_]{1,99}$/.test(normalized)) return normalized;
  return SENSITIVE_FIELD_PATTERN.test(normalized) ? null : normalized;
};

export const sanitizeAuditUserAgent = (
  userAgent: string | undefined,
  maxLength = 1024,
): string | null => {
  if (!userAgent) return null;
  return userAgent.slice(0, Math.max(1, maxLength));
};

export const sanitizeAuditRequestId = (requestId?: string): string | null => {
  if (!requestId) return null;
  const normalized = requestId.trim();
  if (!/^[A-Za-z0-9._:-]{1,100}$/.test(normalized)) return null;
  return normalized;
};
